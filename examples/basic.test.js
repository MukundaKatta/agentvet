/**
 * Basic example: a tool wrapped with vet() throws ToolArgError before
 * the tool runs when the LLM passes wrong-typed args. The error carries
 * a structured message you can feed back to the model as tool_result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { vet, adapters, ToolArgError } from '../src/index.js';

const searchSchema = adapters.shape({
  query: 'string',
  limit: 'number?',
});

test('search tool runs cleanly with valid args', async () => {
  const search = vet({
    name: 'search',
    schema: searchSchema,
    fn: async (args) => [`hit:${args.query}`],
  });
  const out = await search({ query: 'sfo' });
  assert.deepEqual(out, ['hit:sfo']);
});

test('search tool rejects hallucinated arg types with structured feedback', async () => {
  const search = vet({
    name: 'search',
    schema: searchSchema,
    fn: async () => 'should not run',
  });
  try {
    await search({ query: 42, limit: 'lots' }); // model hallucinated wrong types
    assert.fail('expected ToolArgError');
  } catch (err) {
    assert.ok(err instanceof ToolArgError);
    assert.equal(err.tool, 'search');
    assert.match(err.toLLMFeedback(), /Call 'search' again/);
  }
});
