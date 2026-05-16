# Security Policy

## Supported Versions

agentvet is at v0.1.x. Security fixes will be issued for the current minor (0.1.x). Older minors will not receive backports.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use [GitHub's private vulnerability reporting](https://github.com/MukundaKatta/agentvet/security/advisories/new) or email `mukunda.vjcs6@gmail.com` with subject `[agentvet security]`. Include:

- A description of the vulnerability and its impact.
- The version of agentvet affected (`npm ls @mukundakatta/agentvet`).
- Reproduction steps or a minimal PoC (a tool schema + an args payload that bypasses validation is usually enough).
- Any suggested mitigation, if you have one.

You can expect:

- An acknowledgment within 5 business days.
- A status update within 14 days.
- A coordinated disclosure window of at most 90 days from the acknowledgment.

## Specific Risk Surfaces

agentvet wraps a tool function with arg validation. The validated args flow on to the wrapped tool, which typically does real work: hitting a database, writing to disk, calling an API. **Anything that lets bad args reach the wrapped tool is a real issue.** Areas worth special attention:

- **Validation bypass.** If you find a schema + args combination where `validate()` returns `{ valid: true }` but the args don't actually conform to the schema, that's a high-severity report. (Examples: prototype-polluted args, type confusion between string and number, missing required fields silently allowed.)
- **`vet()` wrapper drop.** `vet({...}).fn(args)` must call the validator BEFORE invoking the wrapped function. If you find a path where the wrapped function is invoked first (or the validator is silently bypassed under certain inputs), please report.
- **Prototype pollution from `args`.** Args are caller-provided; the LLM controls them. If a payload containing `__proto__` / `constructor.prototype` survives validation and mutates `Object.prototype`, please report.
- **Catastrophic regex backtracking in the built-in `adapters.shape()` checker.** If you find an LLM-shaped args value (long strings, repeated unicode, deeply nested arrays) that drives shape-checking into super-linear time, that's a real DoS surface for any agent using the bundled adapter.
- **`adapters.zod()` / `adapters.fn()` confusion.** If a caller passes one adapter type where another is expected and the result is "silently no validation," please report.
- **Retry-hint leak.** `ToolArgError` carries a `retryHint` string fed back to the LLM. If sensitive args content can be reflected into the hint (after the LLM produced it), and that hint is later logged to a low-trust store, that's worth reporting.
- **CLI argument handling.** Any path where a flag value lets the validator be tricked into reading from the filesystem or executing arbitrary code.

## Out of scope

- **Schema correctness.** Zod, valibot, JSON Schema, predicate functions: BYO. Bugs in their validation logic should be reported upstream.
- **Wrapped tool implementation.** If your wrapped function does something dangerous with the validated args, that's the wrapped function's problem.
- **LLM hallucination quality.** If the model emits args that pass a too-loose schema, tighten your schema.

## Dependencies

agentvet has **zero** runtime dependencies, by design. The only dev dependency is `c8` for coverage. Any future addition is reviewed for security impact and dependency confusion risk.

We will not pay bug bounties at this time.
