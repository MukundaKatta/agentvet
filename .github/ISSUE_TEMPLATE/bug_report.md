---
name: Bug report (non-security)
about: Validation rejects legitimate args, a ToolArgError retry hint is unhelpful, an adapter doesn't bridge to your validator, the CLI misbehaves. Not for validation-bypass reports.
title: "[bug] "
labels: bug
assignees: ''
---

> ⚠ **Found a way for bad args to pass validation and reach the wrapped tool?** Stop. Use [GitHub's private vulnerability reporting](https://github.com/MukundaKatta/agentvet/security/advisories/new) instead of this template. See `SECURITY.md`.

## What happened

A clear, concise description of the actual behavior.

## What you expected

A clear, concise description of what should have happened.

## Reproduction

Minimal repro using only this library:

```js
import { vet, validate, adapters, ToolArgError } from '@mukundakatta/agentvet';

// the smallest schema that reproduces the bug
const schema = adapters.shape({
  q: 'string',
  limit: 'number?',
});

// either as a wrapped tool:
const search = vet({
  name: 'search',
  schema,
  fn: async (args) => ({ results: [] }),
});

try {
  await search({ q: 'hello', limit: 'ten' });  // observed: ...
} catch (e) {
  if (e instanceof ToolArgError) {
    console.log('retryHint:', e.retryHint);
  } else {
    throw e;
  }
}

// or as a one-off check:
const r = validate('search', schema, { q: 'hello' });
console.log(r);  // observed: ...; expected: ...
```

## Environment

- agentvet version: (`npm ls @mukundakatta/agentvet`)
- Node version: (`node --version` — agentvet requires Node 20+)
- OS: (macOS 14 / Ubuntu 22.04 / Windows 11)
- Validator: (zod / valibot / ajv / `adapters.fn` / `adapters.shape`) + version
- Agent framework / SDK calling the vetted tool:

## Notes

Anything else — whether the failing args came from a real LLM response or a synthetic test, whether the wrapped function has any side effects, whether the same schema works with `validate()` but fails through `vet()` (or vice versa).
