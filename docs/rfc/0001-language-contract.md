# RFC 0001 — Rhen language constitution and semantic design

**Status:** PROPOSED, not implemented or approved · **Date:** 2026-11-04 · **Owner:** Devon Alan Akins · **Scope:** real-world programming language, not fictional Anevum Rhen or Vesper finance.

## Executive decision

Rhen aims to be (a) a useful, stand-alone, human-readable general-purpose language and (b) a rigorous semantic-interchange and code-transformation platform. Both purposes rely on a shared, typed, versioned semantic core. AI is an optional client; compilation, inspection and verification must work offline with no model API.

**Current evidence:** [M0 draft PR #1](https://github.com/devonalanakins/rhen/pull/1) implements only integer expressions, immutable `let` variables, `print`, a small JSON IR and one-way JavaScript/Python emitters. Exact-head CI at `9d9e5a78` passed. This RFC does not describe those proposed facilities as implemented.

## Product promise and non-promises

1. **Write:** humans can compose understandable Rhen projects from source without interacting with AI.
2. **Understand:** names, types, control flow, effects, data contracts and origin of source are inspectable by humans and tools.
3. **Transform:** bounded adapters can analyze existing languages, report incompatibility and propose safe source changes, subject to explicit authorization.
4. **Verify:** language implementation and transformations supply reproducible test evidence, not vague claims that code is correct.
5. **Measure:** correctness, comprehension, compile/runtime cost and AI-assisted outcomes are benchmarked against public baselines.

**Not promised:** universal translation; guaranteed semantic equivalence for arbitrary programs; lower tokens or greater AI correctness; automatic bug-free code; absolute security; a fully formal proof of software; native compilation in the first release; dependency-free operation of all future adapters.

## Target users and first important jobs

| User | First valuable outcome | Adoption model |
| --- | --- | --- |
| Programmer learning Rhen | Write a small CLI/tool with legible errors and standard tests | Stand-alone Rhen |
| Open-source maintainer | Inspect a safe subset of existing TypeScript, find a compatibility barrier | Rhen Bridge, read-only |
| AI-assisted engineer | Submit a structured, reviewable proposed edit with traceable tests | Optional protocol, explicit approval |
| Educator/researcher | Compare language readability and evaluation reproducibly | Open test corpus |
| Systems developer | Create portable, capability-scoped components | Later packages and WASM, gated |

The earliest useful demo is **an offline, deterministic Rhen program that runs equivalently in two target runtimes and yields a structured semantic trace.** The earliest Bridge demo is an **inspect-only TypeScript subset** with an honest unsupported-construct report.

## Design principles and ranked trade-offs

- **Correctness and explicit limitations > surface brevity.**
- **Human readability > minimizing raw source tokens.** A separate compact protocol representation may optimize model transport.
- **Portability > fastest native code at first.** Semantics must be stated before optimizing.
- **No hidden ambient effects.** Capability checks and explicit interfaces outrank magic convenience.
- **No rewrite-first migration.** Existing-language users can adopt analysis without converting entire projects.
- **Finite, auditable scope > claiming all-language support.**
- **Fully open-source, inspectable and self-hostable.** A source license must be owner-approved before merge/public release.
- **Stable behavioral contracts > preserving experimental implementation quirks.** M0 is a baseline, not a frozen language standard.

## Proposed syntax v0.1 (not M0 executable)

Use conventional braces for blocks, UTF-8 source, `#` line comments, explicit `fn` and `type` declarations, and mandatory type annotations at public API boundaries. Inside bodies, `let` inference is permitted when unambiguous. Avoid context-dependent whitespace and gratuitous punctuation.

```rhen
# Illustrative Rhen v0.1, NOT accepted by the current M0 compiler.
pub type Rect = {
    width: Int,
    height: Int,
}

pub fn area(rect: Rect) -> Int {
    rect.width * rect.height
}

fn classify(value: Int) -> Text {
    if value > 0 {
        "positive"
    } else if value == 0 {
        "zero"
    } else {
        "negative"
    }
}

let shape = Rect { width: 12, height: 3 }
let label = classify(area(shape))
```

**Syntax proposal:** expressions return values; the last expression of a block is its result, and `return` is available for early exit. Lines separate declarations/statements; a semicolon may disambiguate same-line statements, but automatic insertion rules must be formally specified. Braces define blocks, not indentation. Public function signatures cannot depend on inference across package boundaries. No implicit fallthrough in pattern matching.

### Proposed core surface grammar (fragment)

```ebnf
module       := (use_decl | type_decl | enum_decl | fn_decl | const_decl)*
fn_decl      := visibility? "fn" NAME type_params? "(" params? ")" "->" type effects? block
effects      := "requires" "[" cap_list? "]"
type_decl    := visibility? "type" NAME type_params? "=" record_type
enum_decl    := visibility? "enum" NAME type_params? "{" variants "}"
block        := "{" statements* expr? "}"
bind         := "let" NAME (":" type)? "=" expr
decision     := "if" expr block ("else" (decision | block))?
match_expr   := "match" expr "{" arms "}"
call         := expr "(" args? ")"
```

The grammar deliberately defers exact lexical identifiers, Unicode normalization, operators/precedence, strings/escapes, generic constraints, pattern exhaustiveness, and inter-statement separators to testable detailed specifications. It must be unambiguous before any declaration of stability.

## Type system

**Proposed static, mostly nominal types with local inference and parametric generics.** Do not mix unrestricted implicit casts or structural assignability into public interfaces without an evidence-backed need.

| Type family | Proposed contract |
| --- | --- |
| `Unit`, `Bool` | Exactly one unit value; booleans not interchangeable with integers |
| `Int` | Signed 64-bit checked integer; each operation either returns in-range result or raises specified arithmetic trap |
| `Float64` | IEEE-754 binary64, defined NaN/-0/infinity and conversion rules; implement only with cross-target fixtures |
| `Text` | Unicode scalar sequence, UTF-8 encoded at external boundaries; indexes are not implicit bytes or graphemes |
| `Bytes` | Raw byte sequence, never silently converted to text |
| `List<T>` | Indexed sequence with bounds checking; immutable value semantics by default |
| `Map<K,V>` | Deterministic semantic lookup; iteration order must be specified or explicitly unspecified |
| `Option<T>` | `Some(T)` / `None`; no implicit null |
| `Result<T,E>` | `Ok(T)` / `Err(E)`; normal recoverable error mechanism |
| Records/enums | Named fields and tagged variants; exhaustive `match` required |
| Generics | Compile-time typed parameterization, bounded by explicit constraints |

**Numeric migration:** M0 currently accepts only signed JavaScript-safe integers, approximately ±(2^53−1). The proposed v0.1 `Int` is *not* backward-compatible at the runtime representation level. On JavaScript lower through BigInt plus checked range operations; on Python use its integer type plus the same range checks. Validate both at every arithmetic operation; mixed `Int`/`Float64` conversions require explicit APIs. The `-2^63` literal and negation edge must have a specific lexical/semantic rule rather than being rejected accidentally by a positive-literal parser.

**Types to postpone:** ownership/borrow syntax, arbitrary precision arithmetic, units of measure, structural subtyping, runtime metaprogramming, macro systems, dependent types and unrestricted union types. They may be research directions but are not needed for the first useful language.

## Evaluation and operational semantics

- Immutable binding is the default. Reassignment, mutable references and shared mutable objects are not in v0.1. Records and lists have value semantics at the language level; runtimes may share immutable storage as an optimization.
- Evaluation order is source order, left-to-right for operands and call arguments. The compiler may reorder only when observable equivalence is established.
- Function calls are deterministic for pure functions. Stack behavior, recursion bounds and runtime exhaustion require separate documented limits; a type system does not itself guarantee termination.
- `if` requires `Bool`; pattern matching must be exhaustive at compile time for closed enums.
- Integer overflow and division by zero are defined arithmetic traps, separate from `Result` application errors.
- Host capabilities and external IO are **not** available from pure functions. No sandbox claim follows from the effect system alone.
- Equality and hashability must be explicit protocols/traits where defined, not automatically applied to opaque handles or effects.
- Target output MUST match the reference interpreter on supported observable results, defined traps and effects under a fixed runtime/environment contract.

## Effects and capabilities

Use declarations such as `requires [fs.read, net, clock]` as a *readable proposed syntax*. Effects are transitive at the call graph boundary; a pure caller cannot invoke an IO function unless its own signature permits the effect. A host must separately grant concrete capabilities (e.g., path allowlist), and generated target runtimes must enforce them. The effect checker does not imply that arbitrary untrusted generated JavaScript/Python becomes sandboxed.

Example illustrating boundaries:

```rhen
pub fn load_report(path: Text) -> Result<Text, FileError>
    requires [fs.read] {
    fs.read_text(path)
}
```

Detailed treatment of async/cancellation, exception interoperability, FFI, capabilities delegated across packages, and native unsafe code is deferred until after the pure language and first adapter are verified.

## Standard library v0.1

Required for useful offline programs: immutable collections, typed arithmetic, strings/text encoding, basic formatting, `Option`, `Result`, deterministic test assertions, local files via explicit capability, simple CLI arguments. No default HTTP, database layer, GUI toolkit, opaque AI runtime, third-party code host, or hidden network dependency.

## Open questions requiring an explicit RFC decision

1. Lexical Unicode identifier policy and normalization, especially confusables and diagnostics.
2. Whether `Int` is fixed 64-bit or supports explicit-width variants only; current recommendation: checked `Int` = i64, with named smaller/unsigned types later.
3. Generic constraints and public API compatibility model.
4. Pure function exception/trap taxonomy.
5. Deterministic map iteration and encoding canonicalization.
6. Precise `requires` syntax and least-privilege runtime capability grants.
7. Memory/runtime strategy for native targets; do not select garbage collection, ARC, borrow checker or native compiler on ideology alone.

## Research evidence, citations and distinction

- [Rust compiler stages](https://rustc-dev-guide.rust-lang.org/overview.html) are architectural precedent for separating syntax/HIR/MIR; copying Rust's type and ownership model is *not* a decision.
- [MLIR dialects](https://mlir.llvm.org/docs/DefiningDialects/) demonstrate extensible operation/type representations, but adopting MLIR itself is not required.
- Rhen's measured user advantage, universality, originality and AI-efficiency are **hypotheses** until the associated public benchmarks and counterexamples exist.

**Gate:** This RFC is PROPOSED. Implement only through bounded PRs with independently tested semantic contracts. Preserve M0 as a golden regression baseline until any intentional versioned break is accepted.
