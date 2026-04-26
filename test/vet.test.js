import { test } from 'node:test';
import assert from 'node:assert/strict';

import { vet, validate, adapters, ToolArgError } from '../src/index.js';

test('vet() lets through valid args and calls the underlying fn', async () => {
  let received = null;
  const search = vet({
    name: 'search',
    schema: adapters.shape({ query: 'string', limit: 'number' }),
    fn: async (args) => {
      received = args;
      return [`hit:${args.query}`];
    },
  });

  const out = await search({ query: 'sfo', limit: 10 });
  assert.deepEqual(out, ['hit:sfo']);
  assert.deepEqual(received, { query: 'sfo', limit: 10 });
});

test('vet() throws ToolArgError BEFORE the fn runs on invalid args', async () => {
  let called = false;
  const search = vet({
    name: 'search',
    schema: adapters.shape({ query: 'string', limit: 'number' }),
    fn: async () => {
      called = true;
      return 'should not run';
    },
  });

  await assert.rejects(() => search({ query: 42, limit: 'lots' }), (err) => {
    assert.ok(err instanceof ToolArgError);
    assert.equal(err.tool, 'search');
    assert.match(err.validationError, /query.*string/);
    assert.deepEqual(err.args, { query: 42, limit: 'lots' });
    return true;
  });
  assert.equal(called, false, 'fn must NOT run when args invalid');
});

test('vet() ToolArgError.toLLMFeedback() formats for retry', async () => {
  const tool = vet({
    name: 'book_flight',
    schema: adapters.shape({ flight_id: 'string' }),
    fn: async () => 'booked',
  });

  try {
    await tool({ flight_id: 12345 });
    assert.fail('expected throw');
  } catch (err) {
    const msg = err.toLLMFeedback();
    assert.match(msg, /book_flight/);
    assert.match(msg, /flight_id/);
    assert.match(msg, /Call 'book_flight' again/);
  }
});

test('vet() with onError can substitute a return value (suppress throw)', async () => {
  const tool = vet({
    name: 'risky',
    schema: adapters.shape({ value: 'number' }),
    fn: async (args) => args.value * 2,
    onError: () => ({ ok: false, fallback: true }),
  });

  const result = await tool({ value: 'oops' });
  assert.deepEqual(result, { ok: false, fallback: true });
});

test('vet() with onError returning undefined still throws', async () => {
  const tool = vet({
    name: 'risky',
    schema: adapters.shape({ value: 'number' }),
    fn: async () => 1,
    onError: () => undefined, // don't suppress
  });

  await assert.rejects(() => tool({ value: 'bad' }), ToolArgError);
});

test('vet() passes through the validator-coerced value when present', async () => {
  // A validator that uppercases the query field as part of validation
  const coercingValidator = (args) => {
    if (typeof args?.query !== 'string') return { valid: false, error: 'query must be string' };
    return { valid: true, value: { ...args, query: args.query.toUpperCase() } };
  };

  let received;
  const tool = vet({
    name: 'normalize',
    schema: coercingValidator,
    fn: async (args) => {
      received = args;
    },
  });
  await tool({ query: 'hello' });
  assert.equal(received.query, 'HELLO');
});

test('vet() rejects bad spec', () => {
  assert.throws(() => vet(null), TypeError);
  assert.throws(() => vet({ name: '', schema: () => {}, fn: () => {} }), TypeError);
  assert.throws(() => vet({ name: 'x', schema: 'not fn', fn: () => {} }), TypeError);
  assert.throws(() => vet({ name: 'x', schema: () => {}, fn: 'not fn' }), TypeError);
  assert.throws(
    () => vet({ name: 'x', schema: () => ({ valid: true }), fn: () => {}, onError: 'not fn' }),
    TypeError
  );
});

test('vet() rejects validators that return non-objects', async () => {
  const tool = vet({
    name: 'broken',
    schema: () => null, // bad validator
    fn: async () => 'ok',
  });
  await assert.rejects(() => tool({}), TypeError);
});

test('validate() returns structured result on success', () => {
  const r = validate('search', adapters.shape({ q: 'string' }), { q: 'hi' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.value, { q: 'hi' });
});

test('validate() returns ToolArgError instance on failure', () => {
  const r = validate('search', adapters.shape({ q: 'string' }), { q: 42 });
  assert.equal(r.valid, false);
  assert.ok(r.error instanceof ToolArgError);
  assert.equal(r.error.tool, 'search');
});

test('validate() rejects bad inputs', () => {
  assert.throws(() => validate('', () => {}, {}), TypeError);
  assert.throws(() => validate('x', 'not fn', {}), TypeError);
});

test('vet() composes naturally with another wrapper (e.g. tracing)', async () => {
  const calls = [];
  // Outer wrapper that records calls — simulating agentsnap's traceTool
  const traceWrap = (name, fn) => async (args) => {
    calls.push({ name, args });
    return fn(args);
  };

  const search = traceWrap(
    'search',
    vet({
      name: 'search',
      schema: adapters.shape({ q: 'string' }),
      fn: async (args) => `hit:${args.q}`,
    })
  );

  const out = await search({ q: 'sfo' });
  assert.equal(out, 'hit:sfo');
  assert.deepEqual(calls, [{ name: 'search', args: { q: 'sfo' } }]);

  // Bad args — traced first, then vet rejects
  await assert.rejects(() => search({ q: 99 }), ToolArgError);
  assert.equal(calls.length, 2);
});
