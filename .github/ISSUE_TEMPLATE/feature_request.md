---
name: Feature request
about: Propose a new adapter, a new retry-hint heuristic, or a behavior change.
title: "[feat] "
labels: enhancement
assignees: ''
---

## Scope check

Before opening, please confirm this proposal fits the project scope:

- [ ] It does **not** add a runtime dependency. (Zero deps is a hard line; adapters for zod/valibot/etc. are pure-shape bridges, not deps on those libraries.)
- [ ] It does **not** invoke the wrapped tool function ahead of validation. (Validation must run before the wrapped fn under every code path.)
- [ ] It does **not** weaken the "validation result is the only gate" invariant. (No "warn but allow" mode; bad args either throw `ToolArgError` or pass.)

If any of those are unchecked, the right home is probably a separate package that depends on agentvet.

## What you want

A clear description of the proposed feature.

## Why

What real-world tool-call workflow does this address? Concrete example of the args shape that would benefit.

## Proposed API shape

```jsonc
// new adapter or hook:
// signature:
// failure mode (throws ToolArgError / returns valid:false):
```

## Threat-model impact

Does this change the surfaces in `SECURITY.md`?

- [ ] No — orthogonal feature, no new bypass surface.
- [ ] Yes — and here is what I'd add to SECURITY.md: ...

## Alternatives considered

What workarounds exist today (manual `try { schema.parse(args) }`, instructor.js, langchain's tool decorators) and why aren't they good enough?
