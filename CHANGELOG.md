# Changelog

## [Unreleased]

Production-polish branch (this PR): adds `SECURITY.md` (with validation-bypass / wrapper-drop / prototype-pollution surfaces called out), `CODE_OF_CONDUCT.md`, `CODEOWNERS` flagging `vet.js` + `adapters.js` for extra scrutiny, Dependabot config, issue + PR templates (security routing for bypass reports), release workflow with npm provenance OIDC + zero-deps + validation-bypass smoke, expanded CI (macOS + Windows spot-checks, coverage gate, `npm pack` content check, validation-bypass smoke that asserts a vetted tool rejects bad args BEFORE invoking the wrapped fn). No source changes.

## [0.1.2] — 2026-04-28

### Added
- `c8` coverage tooling: `npm run test:coverage` reports per-file coverage
  and gates the build at 70% branches / 80% lines+functions+statements.
- `CHANGELOG.md`, `CONTRIBUTING.md`.
- Top-of-README badges (npm version, downloads, license, Node, tests).
- `Status` line in README now matches the actual test count (30).

### Notes
This is a tooling-only patch; no runtime behavior changed. Pinning at
0.1.2 keeps the agent-stack family (agentfit / agentguard / agentcast /
agentsnap / agentvet / agenttrace) on a unified version line.

## [0.1.1] — 2026-04-25

Initial published release. Tool-arg validator for LLM tool calls. Core API stable, TypeScript types,
CI matrix on Node 20/22/24.

## [0.1.0]

Pre-release placeholder.
