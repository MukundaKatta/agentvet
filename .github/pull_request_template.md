<!--
Thanks for sending a PR to agentvet.

Quick reminders before you submit:
  - Zero runtime dependencies. A PR that adds one will be sent back to discussion first.
  - vet() must call the validator BEFORE invoking the wrapped fn, on every path.
  - The "validation result is the only gate" invariant is hard: no warn-but-allow modes.
  - Tests live in test/ and run via `npm test`. Add an adversarial bypass case for any new adapter.
-->

## What this changes

A one-line summary, then a short paragraph if needed.

## Why

The user-visible bug or workflow gap this addresses.

## Type of change

- [ ] Bug fix in `vet()` / `validate()` / an `adapter` / `ToolArgError`
- [ ] New adapter
- [ ] New retry-hint heuristic
- [ ] CLI fix
- [ ] Test coverage (especially adversarial bypass cases)
- [ ] Documentation
- [ ] CI / build / release plumbing

## Security review

- [ ] If this touches `vet()`, the validator still runs before the wrapped fn under every code path (no early-return or fast-path bypass).
- [ ] If this adds a new adapter, I added at least one test asserting that obviously-bad args are rejected (wrong type, missing required, prototype-polluted input).
- [ ] If this changes the retry-hint format, no user-controlled args content is reflected back without escaping.

## Scope check

- [ ] No new runtime dependencies added (enforced by CI).
- [ ] If this changes the threat-model surface, `SECURITY.md` was updated in the same PR.

## Validation

- [ ] `npm run test:all` passes locally (unit + examples)
- [ ] `npm run test:coverage` still meets the configured thresholds (70% branches / 80% lines+functions+statements)
- [ ] Public API changes are reflected in `src/index.d.ts`

## Linked issue

Closes #
