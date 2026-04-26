import { test } from 'node:test';
import assert from 'node:assert/strict';

import { adapters } from '../src/adapters.js';

test('adapters.shape: required string/number/boolean/array/object', () => {
  const v = adapters.shape({
    name: 'string',
    age: 'number',
    active: 'boolean',
    tags: 'array',
    meta: 'object',
  });
  assert.equal(v({ name: 'a', age: 1, active: true, tags: [], meta: {} }).valid, true);
  const r = v({ name: 1, age: 'old' });
  assert.equal(r.valid, false);
  assert.match(r.error, /name.*string/);
  assert.match(r.error, /age.*number/);
});

test('adapters.shape: optional fields via ?', () => {
  const v = adapters.shape({ q: 'string', limit: 'number?' });
  assert.equal(v({ q: 'x' }).valid, true);
  assert.equal(v({ q: 'x', limit: 10 }).valid, true);
  assert.equal(v({ q: 'x', limit: 'lots' }).valid, false);
});

test('adapters.shape: missing required field surfaces as error', () => {
  const v = adapters.shape({ q: 'string' });
  assert.match(v({}).error, /missing.*q/);
});

test('adapters.shape: rejects non-objects (null, array, primitives)', () => {
  const v = adapters.shape({ q: 'string' });
  assert.equal(v(null).valid, false);
  assert.equal(v([]).valid, false);
  assert.equal(v('hi').valid, false);
});

test('adapters.fn: predicate validation', () => {
  const v = adapters.fn((a) => a?.n > 0);
  assert.equal(v({ n: 1 }).valid, true);
  assert.equal(v({ n: -1 }).valid, false);
});

test('adapters.fn: error builder as function gets the rejected args', () => {
  const v = adapters.fn(
    (a) => false,
    (a) => `bad input: ${JSON.stringify(a)}`
  );
  assert.equal(v({ x: 1 }).error, 'bad input: {"x":1}');
});

test('adapters.zod: passes through safeParse success', () => {
  const fakeSchema = {
    safeParse: (val) => ({ success: true, data: { canonical: val } }),
  };
  const v = adapters.zod(fakeSchema);
  const r = v({ raw: 1 });
  assert.equal(r.valid, true);
  assert.deepEqual(r.value, { canonical: { raw: 1 } });
});

test('adapters.zod: formats safeParse failure with path + message', () => {
  const fakeSchema = {
    safeParse: () => ({
      success: false,
      error: {
        issues: [
          { path: ['query'], message: 'Required' },
          { path: ['limit'], message: 'Expected number, received string' },
          { path: [], message: 'something else' },
        ],
      },
    }),
  };
  const v = adapters.zod(fakeSchema);
  const r = v({});
  assert.equal(r.valid, false);
  assert.match(r.error, /query: Required/);
  assert.match(r.error, /limit: Expected number/);
  assert.match(r.error, /<args>: something else/);
});

test('adapters.zod: throws if schema lacks safeParse', () => {
  assert.throws(() => adapters.zod({}), TypeError);
  assert.throws(() => adapters.zod(null), TypeError);
});
