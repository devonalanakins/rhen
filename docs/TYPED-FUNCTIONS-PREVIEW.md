# Typed-function preview — independent research experiment

**Status:** Experimental, draft-only implementation stacked on [M1A PR #3](https://github.com/devonalanakins/rhen/pull/3). Not part of the current M0 grammar, production release, or approved Rhen edition.

## Purpose

Explore manually readable, statically typed pure-function declarations without silently changing M0's existing `rhen.ir.v0` or arithmetic semantics. The experimental language accepts `fn name(param: SafeInt) -> SafeInt { expression }`, top-level immutable `let` bindings, and `print`. Only `SafeInt` is admitted: signed JavaScript-safe integer values (±(2^53−1)). **This is not the RFC-proposed signed 64-bit `Int`**.

Supported expressions: earlier-bound parameters or top-level values, integer literals, `+`, `-`, `*`, unary negation, parentheses, and calls to earlier-declared functions. Functions are pure; there are no user-visible IO capabilities in function bodies, loops, branches, mutation, recursion, forward calls, strings, records or type inference. Top-level source functions must precede statements. The prototype has separate internal representation `rhen.typed.preview.v0`, not the canonical M0 IR.

## Example

```rhen
fn area(width: SafeInt, height: SafeInt) -> SafeInt {
    width * height
}

fn twice(a: SafeInt, b: SafeInt) -> SafeInt {
    area(a, b) * 2
}

let result = twice(12, 3)
print result
```

The expected output is `72`.

## Run locally

```sh
npm run check
npm test
node bin/rhen-typed.mjs examples/typed-functions.rn --target ir
node bin/rhen-typed.mjs examples/typed-functions.rn --target eval
node bin/rhen-typed.mjs examples/typed-functions.rn --target js | node
node bin/rhen-typed.mjs examples/typed-functions.rn --target python | python3
```

The `ir` target emits an independently validated, versioned and detached `rhen.typed.preview.v0` representation as JSON. `parseTypedPreviewIRJSON` provides a size-bounded, duplicate-key-rejecting ingress for machine-readable IR; `evaluateTypedPreviewIR` and `compileTypedPreviewIR` revalidate IR before use. This is an **experimental preview format, not a stable ABI, public protocol or typed CSIR**. Direct JavaScript Proxy objects remain outside the validator's trust boundary.

The CLI reads local `.rn` input. `eval` calls an independent BigInt reference evaluator, while `js` and `python` **emit source text only**; the compiler itself does not run those outputs. Generated target execution must be treated separately from compiler parsing.

## Bounds and verification

- At most 65,536 UTF-16 source code units, 4,096 tokens, 48 expression nodes of depth, 64 functions, 16 parameters per function, and 16 static function-call levels. Rejects unknown identifiers, duplicate functions/parameters and unsupported constructs before emission.
- Arithmetic uses checked safe integers in the reference evaluator and both emitted runtimes. Output printed before an arithmetic trap remains observable.
- The independent test file contains 20 explicitly expected valid examples, rejected syntax and API cases, arithmetic overflow cases, output-before-trap evidence, source/parameter/depth caps and source-generation safety tests.
- All claims are scoped to this restricted subset and actual passing tests at an exact commit. Successful output is not formal proof, a secure sandbox, a complete general-purpose language, or evidence of AI-efficiency gains.
- There is no external AI, network dependency, financial integration, package publication or secret configuration.

## Architectural limits and next iteration

This separate prototype intentionally duplicates some syntax handling rather than modifying the M0 parser. Before adopting typed functions in the normative language, the reviewed design must reconcile parser sharing, validated typed IR, source spans, edition-aware integer contracts, effect checking and diagnostics with the existing [RFC proposals](rfc/README.md). Avoid merging the preview as an implicit language-standard decision.

**Owner review and open-source license approval remain necessary before any release.** This experimental PR does not modify `LICENSE` or merge the stacked M0/M1A work.
