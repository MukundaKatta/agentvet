import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ToolArgError } from '../src/errors.js';

test('ToolArgError carries tool, validationError, args', () => {
  const err = new ToolArgError('search', 'query: must be string', { query: 42 });
  assert.equal(err.name, 'ToolArgError');
  assert.equal(err.tool, 'search');
  assert.equal(err.validationError, 'query: must be string');
  assert.deepEqual(err.args, { query: 42 });
  assert.match(err.message, /search/);
  assert.match(err.message, /must be string/);
});

test('ToolArgError is catchable as Error and as ToolArgError', () => {
  const err = new ToolArgError('x', 'y', {});
  assert.ok(err instanceof Error);
  assert.ok(err instanceof ToolArgError);
});

test('toLLMFeedback() formats a model-readable retry message', () => {
  const err = new ToolArgError('book_flight', 'flight_id: must be string', { flight_id: 12345 });
  const msg = err.toLLMFeedback();
  assert.match(msg, /book_flight.*rejected/);
  assert.match(msg, /flight_id.*string/);
  assert.match(msg, /Call 'book_flight' again/);
});
