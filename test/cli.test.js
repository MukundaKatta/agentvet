import { test } from 'node:test';
import assert from 'node:assert/strict';

import { main } from '../src/cli.js';

/**
 * Capture stdout/stderr from a single main() invocation.
 * Restores writers in finally so tests don't leak state.
 */
async function captureMain(argv) {
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let stdout = '';
  let stderr = '';
  process.stdout.write = (chunk) => {
    stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    return true;
  };
  try {
    const code = await main(argv);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
}

test('--help prints usage and exits 0', async () => {
  const { code, stdout } = await captureMain(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /agentvet v\d/);
  assert.match(stdout, /validate/);
  assert.match(stdout, /lint/);
});

test('validate exits 0 and emits valid=true for matching args', async () => {
  const args = JSON.stringify({ query: 'sfo', limit: 10 });
  const shape = JSON.stringify({ query: 'string', limit: 'number' });
  const { code, stdout } = await captureMain(['validate', args, '--shape', shape, '--name', 'search']);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.valid, true);
  assert.deepEqual(out.value, { query: 'sfo', limit: 10 });
});

test('validate exits 1 and emits retry_hint when args are wrong', async () => {
  const args = JSON.stringify({ query: 42 });
  const shape = JSON.stringify({ query: 'string', limit: 'number' });
  const { code, stdout } = await captureMain(['validate', args, '--shape', shape, '--name', 'search']);
  assert.equal(code, 1);
  const out = JSON.parse(stdout);
  assert.equal(out.valid, false);
  assert.equal(out.tool, 'search');
  assert.match(out.error, /query/);
  assert.match(out.retry_hint, /search/);
});

test('lint flags missing input_schema as a hard error (exit 1)', async () => {
  const tool = JSON.stringify({ name: 'search', description: 'do a search' });
  const { code, stdout } = await captureMain(['lint', tool]);
  assert.equal(code, 1);
  const out = JSON.parse(stdout);
  assert.equal(out.valid, false);
  assert.ok(out.issues.some((i) => i.path === 'input_schema' && i.severity === 'error'));
});

test('lint passes (exit 0) for a well-formed tool with warnings only', async () => {
  const tool = JSON.stringify({
    name: 'search',
    description: 'do a search',
    input_schema: { type: 'object', properties: {} },
  });
  const { code, stdout } = await captureMain(['lint', tool]);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.valid, true);
});

test('unknown subcommand exits 2 with usage error', async () => {
  const { code, stderr } = await captureMain(['nope']);
  assert.equal(code, 2);
  assert.match(stderr, /unknown subcommand/);
});
