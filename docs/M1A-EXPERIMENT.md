# Rhen M1A — semantic validation and evaluator

**Status:** Draft implementation stacked on M0 PR #1. Not merged or released. This is not a full language or universal source-code translator.

## What has been implemented in this slice

M0 generated JavaScript and Python for a small integer-expression language, but lacked a separate execution oracle and strict validation of the emitted intermediate representation. M1A adds a validated IR boundary, an independent reference evaluator, a versioned structural schema, and cross-target differential fixtures.

```text
.rn -> M0 parser -> validateIR -> rhen.ir.v0 -> JS/Python output
                      |
                      +-> evaluator -> observable print trace
```

All components run locally. No network access, credentials, package registry, or AI service is involved.

## Reproduce

```sh
npm run check
npm test
node bin/rhen.mjs examples/hello.rn --target eval
node bin/rhen.mjs examples/hello.rn --target ir
node bin/rhen.mjs examples/hello.rn --target js | node
node bin/rhen.mjs examples/hello.rn --target python | python3
```

The `eval` target interprets only the admitted M0 arithmetic and print subset and returns its observable output. It does not execute arbitrary JavaScript/Python files. Emission to a target also does not execute the emitted code.

## Semantic contract

- The IR version is exactly `rhen.ir.v0`. Unknown fields, node kinds, operators, invalid names, duplicate names and unexpected object shapes are rejected, not ignored.
- Binding slots are sequential from zero; reads can only reference completed declarations. No external names or arbitrary source are evaluated.
- M0 numbers are nonnegative JavaScript-safe integer literals, with negative values represented by explicit `Negate` nodes. Malformed floats, NaN, infinity and negative-zero Number nodes are rejected.
- Intermediate arithmetic results must remain inside the signed safe-integer envelope: ±(2^53 − 1). The independent evaluator uses `BigInt` to avoid precision loss; generated JavaScript and Python code are separately checked.
- A deterministic JSON schema (`docs/ir/v0.schema.json`) specifies node shapes, but **does not replace the semantic validator**, which enforces slots, binding order, duplicate names, and runtime limits.
- Validation copies a sanitized IR tree. It rejects accessor-backed, sparse, non-enumerable, symbol-bearing, extended or custom-prototype statement arrays before accessing their elements. Foreign machine-readable input must use the size-bounded `parseIRJSON` entry point. Direct JavaScript Proxy objects remain outside this API's trust boundary; this is not an execution sandbox.
- Expression depth is bounded across all output targets, including JSON IR. This intentionally rejects some long, flat expressions the M0 parser can construct but whose original emitters could not handle.
- Generated JavaScript normalizes negative zero to `0`, matching Python and the reference evaluator. That fixes a demonstrated M0 target discrepancy.
- M0 `print` is treated as an observable ordered stdout trace, not a pure expression. When later arithmetic traps, the reference evaluator's exception retains the earlier stdout prefix, matching the generated targets. Different target-specific stack traces are not declared equivalent.

## Test evidence and limits

The separate M1A test file contains over 60 explicitly expected valid programs, more than 20 rejected source cases, malformed IR cases, arithmetic overflow cases where later operations cannot mask an intermediate failure, and a deterministic 160-statement arithmetic corpus. Actual passing results must be tied to the exact PR commit and CI workflow.

These tests do **not** prove universal semantic equivalence, formal correctness, production security, or superiority to other programming languages. No functions, strings, types, modules, arbitrary-language imports, formal IR ABI, hosted services, or AI optimizations exist in this slice.

## Next gate

Independently review this PR against the exact M0 parent, run GitHub CI at its final head, and resolve any issues. The earlier M0 PR contains a proposed MIT license that still requires owner approval before merging. Later i64, typed-function or Bridge features require separate versioned specifications and implementation PRs.
