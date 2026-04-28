# agentvet

[![npm version](https://img.shields.io/npm/v/@mukundakatta/agentvet.svg)](https://www.npmjs.com/package/@mukundakatta/agentvet)
[![npm downloads](https://img.shields.io/npm/dm/@mukundakatta/agentvet.svg)](https://www.npmjs.com/package/@mukundakatta/agentvet)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/@mukundakatta/agentvet.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-30%2F30-brightgreen.svg)](./test)

**Validate LLM-generated tool args before execution.** Wrap your tools with a schema; throws `ToolArgError` *before the tool runs* when the model hallucinates wrong types or misses required fields. Carries a structured message you can feed back to the model as a tool_result for next-turn correction. Zero runtime dependencies.

```bash
npm install @mukundakatta/agentvet
```

```js
import { vet, adapters, ToolArgError } from '@mukundakatta/agentvet';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(100),
});

const search = vet({
  name: 'search',
  schema: adapters.zod(searchSchema),
  fn: async ({ query, limit }) => doSearch(query, limit),
});

// Inside your agent loop, when the LLM emits a tool_use block:
try {
  const result = await search(toolUse.input);
  // send `result` back as tool_result
} catch (err) {
  if (err instanceof ToolArgError) {
    // send `err.toLLMFeedback()` back as tool_result with is_error: true
    // The model sees what went wrong and retries with corrected args
  }
}
```

If the model passes `search({ query: 42 })`, the tool **never runs** — the side effect is prevented before it can happen, and the LLM gets a structured retry hint.

TypeScript types ship in the box.

### See it in action

```bash
git clone https://github.com/MukundaKatta/agentvet && cd agentvet
node examples/demo-reject.js
```

A simulated agent loop where the model hallucinates a number for a string arg, agentvet rejects it before `book_flight` runs, feedback is sent back, and the model "corrects" on retry. The dangerous side effect (booking) only happens with validated args.

## Why

LLMs hallucinate tool arguments. They pass:

- A number where a string was expected (`flight_id: 12345` instead of `"UA123"`)
- A string where an enum was expected (`seat: "window"` when the enum is `'window' | 'aisle' | 'middle'`)
- Forget required fields entirely
- Pass extra fields that confuse downstream code

If your tool runs anyway, it either crashes deep in your code (with a stack trace the LLM can't act on) or — worse — it actually does something with the bad args. Booking the wrong flight. Sending the wrong email. Charging the wrong card.

`vet()` makes the tool refuse before any side effect, with an error message designed to feed back to the model so the next turn can correct itself.

## API

### `vet({name, schema, fn, onError?}) → wrapped fn`

Wrap a tool function with arg validation.

```js
const wrapped = vet({
  name: 'search',           // required: tool name (surfaces in errors)
  schema: validator,        // required: validator function
  fn: async (args) => ...,  // required: the underlying tool
  onError: (err, args) => undefined, // optional: see below
});
```

If `onError` returns a non-`undefined` value, that value is used as the tool's return value (suppresses the throw). Useful for falling back to a default response instead of erroring up the agent loop.

### `validate(name, schema, args) → { valid, value | error }`

One-shot check without wrapping a tool. Useful for inline validation or when you want to inspect the error before deciding what to do.

```js
const r = validate('search', adapters.zod(schema), userArgs);
if (!r.valid) console.error(r.error.toLLMFeedback());
```

### `adapters.zod(schema)`

Bridge for any validator with a `safeParse()` method (zod, valibot, etc.).

```js
import { z } from 'zod';
const validate = adapters.zod(z.object({ query: z.string() }));
```

### `adapters.fn(predicate, errorBuilder?)`

Ad-hoc predicate validation, no schema lib needed.

```js
const validate = adapters.fn(
  (a) => typeof a?.query === 'string' && a.query.length > 0,
  'query must be a non-empty string'
);
```

### `adapters.shape(spec)`

Tiny built-in shape checker for zero-dep end-to-end validation.

```js
const validate = adapters.shape({
  query: 'string',
  limit: 'number?',  // suffix '?' for optional
  filters: 'object?',
});
```

Not a full JSON Schema validator — just enough to gate basic tool-arg shapes.

### `ToolArgError`

```js
import { ToolArgError } from '@mukundakatta/agentvet';

try {
  await tool(args);
} catch (err) {
  if (err instanceof ToolArgError) {
    err.tool;            // tool name
    err.validationError; // string from the validator
    err.args;            // the rejected args
    err.message;         // human-readable
    err.toLLMFeedback(); // string formatted for the LLM to read + retry with
  }
}
```

## Recipes

### Anthropic SDK tool loop

```js
import Anthropic from '@anthropic-ai/sdk';
import { vet, adapters, ToolArgError } from '@mukundakatta/agentvet';

const tools = {
  search: vet({
    name: 'search',
    schema: adapters.shape({ query: 'string', limit: 'number?' }),
    fn: async ({ query, limit = 10 }) => api.search(query, limit),
  }),
};

const client = new Anthropic();
const messages = [{ role: 'user', content: 'find me coffee shops' }];

while (true) {
  const r = await client.messages.create({ model: 'claude-sonnet-4-6', tools: schemas, messages, max_tokens: 1024 });
  if (r.stop_reason !== 'tool_use') break;

  const toolUses = r.content.filter((b) => b.type === 'tool_use');
  const results = await Promise.all(toolUses.map(async (use) => {
    try {
      const data = await tools[use.name](use.input);
      return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(data) };
    } catch (err) {
      if (err instanceof ToolArgError) {
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: err.toLLMFeedback(),
          is_error: true,
        };
      }
      throw err;
    }
  }));

  messages.push({ role: 'assistant', content: r.content });
  messages.push({ role: 'user', content: results });
}
```

### Compose with agentsnap's traceTool

```js
import { traceTool } from '@mukundakatta/agentsnap';
import { vet, adapters } from '@mukundakatta/agentvet';

const search = traceTool('search', vet({
  name: 'search',
  schema: adapters.shape({ query: 'string' }),
  fn: async ({ query }) => api.search(query),
}));

// Now: invalid args are rejected (vet) and the rejection is recorded (traceTool).
// Inside record(), you'll see the failed tool attempt in the trace.
```

### Fallback instead of throwing

```js
const summarize = vet({
  name: 'summarize',
  schema: adapters.shape({ text: 'string' }),
  fn: async ({ text }) => llm.summarize(text),
  onError: (err, args) => ({ summary: '', error: err.validationError }),
});
```

## CLI

`@mukundakatta/agentvet` ships an `agentvet` binary for one-off validation and lint checks (handy when sanity-checking an LLM tool definition or eyeballing a single tool_use blob):

```bash
# Validate a JSON args blob against a shape (exit 1 if invalid)
echo '{"query":42}' | npx -p @mukundakatta/agentvet agentvet validate - \
  --shape '{"query":"string","limit":"number"}' --name search --pretty

# Lint a tool definition (exits 1 on hard errors like missing input_schema)
npx -p @mukundakatta/agentvet agentvet lint tool.json --pretty
```

Output is JSON to stdout (use `--pretty` for indented). When validation fails, the JSON includes a `retry_hint` you can pipe straight back to the model as `tool_result` content with `is_error: true`. Exit code is `0` when valid, `1` when invalid, `2` on usage errors. Run `agentvet --help` for the full subcommand reference.

## What this is not

- **Not an output validator.** This validates what the LLM passes IN to a tool. For validating what the LLM returns at the end of a generation, use [`@mukundakatta/agentcast`](https://www.npmjs.com/package/@mukundakatta/agentcast).
- **Not a network firewall.** This stops bad args from reaching your function. For stopping bad URLs from reaching the wire, use [`@mukundakatta/agentguard`](https://www.npmjs.com/package/@mukundakatta/agentguard).
- **Not a schema generator.** It runs your existing schema as a validator; it doesn't generate the JSON Schema you pass to the model. Pair with `zod-to-json-schema` (or your tool format generator of choice).

## Sibling libraries

Part of the agent reliability stack — all `@mukundakatta/*` scoped, all zero-dep:

- [`@mukundakatta/agentfit`](https://www.npmjs.com/package/@mukundakatta/agentfit) — fit messages to budget. *Fit it.*
- [`@mukundakatta/agentsnap`](https://www.npmjs.com/package/@mukundakatta/agentsnap) — snapshot tests for tool-call traces. *Test it.*
- [`@mukundakatta/agentguard`](https://www.npmjs.com/package/@mukundakatta/agentguard) — network egress firewall. *Sandbox it.*
- **`@mukundakatta/agentvet`** — tool-arg validator. *Vet it.*
- [`@mukundakatta/agentcast`](https://www.npmjs.com/package/@mukundakatta/agentcast) — structured output enforcer. *Validate it.*

Natural pipeline: **fit** the prompt → **guard** the network → **snap** the run → **vet** the tool args → **cast** the output.

## Status

v0.1.2 — tooling polish. Core API stable. TypeScript types included. 30/30 tests, CI on Node 20/22/24.

**v0.2 plans** (post-real-world-feedback):
- Auto-generate JSON Schema for the model from the same validator (so you don't maintain schemas in two places)
- Per-tool budget (max retries before giving up on this tool)
- Telemetry hook (every reject → your sink)

## License

MIT
