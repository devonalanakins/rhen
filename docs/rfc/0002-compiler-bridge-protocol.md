# RFC 0002 — Compiler pipeline, semantic IR, and Rhen Bridge

**Status:** PROPOSED · **Date:** 2026-11-04 · **Depends on:** [RFC 0001](0001-language-contract.md) · **Baseline:** [M0 draft PR #1](https://github.com/devonalanakins/rhen/pull/1), not merged.

## Why a semantic core, not a universal syntax converter

Parsing a program is not equivalent to understanding its behavior. Python, TypeScript, Rust, Go, SQL, C and others differ in evaluation order, coercions, memory, effects, error propagation, async behavior, libraries and build-time configuration. Rhen cannot truthfully claim to transform arbitrary code merely because an AST exists.

The architectural goal is **closed, tested islands of semantic compatibility** with explicit unsupported edges, source provenance, and fail-closed modifications. A larger compatible island may be added only with specifications and independently reproducible tests.

## Compiler stages and ownership

```text
Source text (.rn)                 External source (TypeScript first)
    |                                    |
    v                                    v
Lexer + lossless CST*             External parser + CST/AST*
    |                                    |
    v                                    v
Name-resolved HIR                 Adapter + incompatibility report
    |                                    |
    +---------------+--------------------+
                    v
        Typed HIR + effect signatures
                    |
                    v
         Core Semantic IR (CSIR)
                    |
          +---------+---------+
          |         |         |
          v         v         v
     Evaluator   Validators   Transform plans
          |         |         |
          +---------+---------+
                    v
             Target backends
                    |
           JS / Python / WASM*
```

Asterisks indicate *future/optional* stages. M0 currently has only a scanner/parser, primitive JSON IR and bounded one-way JS/Python emitters. No lossless CST, typed HIR, runtime evaluator, real external-language adapters or WASM backend exists. Build only what the next testable slice requires.

### Stage contracts

| Stage | Inputs and outputs | Responsible for | Must never silently do |
| --- | --- | --- | --- |
| Scanner/CST | UTF-8 source -> tokens with trivia/spans | Source preservation, diagnostics | Drop comments/formatting before source editing |
| AST/HIR | CST -> names/scopes/control structures | Name resolution and desugaring | Execute code during parsing |
| Typed HIR | Resolved HIR -> typed nodes + capabilities | Type/effect checks, generics lowering | Invent absent signatures |
| CSIR | Typed HIR -> validated, versioned operations | Stable semantic facts and preconditions | Represent incompatible semantics as equivalent |
| Reference evaluator | CSIR -> observable result/trap trace | Executable oracle for supported pure subset | Claim proof of correctness beyond subset |
| Backend | Validated CSIR -> target text/artifacts | Preserve supported behavior and capabilities | Change numeric/effect semantics without report |
| Source adapter | External parser -> compatibility facts/CSIR | Mark mapped, conditional and rejected constructs | Ignore unsupported source to make build 'succeed' |

## Three IR layers, with different jobs

1. **CST (Concrete Syntax Tree):** retains comments, whitespace, token spans, quote spelling and perhaps formatting. Needed for edits to existing source. A compiler-only AST is not an adequate source-code patch engine.
2. **HIR (High-level Intermediate Representation):** links names, types, scopes and source origins; resolves syntax without losing useful diagnostics.
3. **CSIR (Core Semantic IR):** normalizes only the semantics that Rhen can actually define, including explicit integer behavior, control flow, effects, function calls and error conditions. CSIR is *not* the source of truth for whitespace or arbitrary external-language quirks.

CSIR versioning is separate from language source versioning, backend versions and bridge-adapter versions. A schema change never silently aliases an older meaning.

## Proposed CSIR envelope (illustrative JSON, not implemented)

```json
{
  "schema": "rhen.csir.v1",
  "source": {
    "language": "rhen",
    "edition": "2027-preview",
    "sha256": "<hex-digest>",
    "path": "src/main.rn"
  },
  "semantics": {
    "numeric": "checked-i64",
    "evaluation_order": "left-to-right",
    "effects": []
  },
  "functions": [
    {
      "symbol": "main",
      "params": [],
      "returns": "Int",
      "body": [
        {
          "op": "int.add.checked",
          "inputs": [{"int": "12"}, {"int": "30"}],
          "result": "v0",
          "type": "Int",
          "origin": {"start_byte": 0, "end_byte": 7}
        }
      ],
      "result": "v0"
    }
  ]
}
```

**Serialization and verification requirements:** canonical JSON form or a separately versioned binary form; bounded byte and node counts; structural schema validation; unique node/symbol identities; explicit version/capability compatibility; typed operands; no use-before-definition; valid control-flow graph; source span bounds; no undefined/effectful operation silently treated as pure. Hash verified input bytes rather than an untrusted filename; path metadata is advisory and must be sanitized before publication.

Numbers crossing JSON boundaries must not be stored as floating-point JSON numerals when precision would be lost. Encode i64 values as decimal strings with explicit integer type and range validation. Digest/canonicalization rules must have independent test vectors, not home-grown ambiguous encoders.

No raw source code, credentials or confidential snippets in a public evidence receipt without explicit permission.

## Semantics and equivalence

Define the observable outcome of a program in a fixed environment as:

`Obs(program, input, env) = (return_value_or_trap, permitted_effect_trace)`

For the admitted pure subset, require:

`Obs(reference(CSIR(program))) == Obs(JS_backend(CSIR(program))) == Obs(Python_backend(CSIR(program)))`

The equality is conditional on an explicit type/precision/encoding/target runtime contract. For effectful programs compare capability-scoped traces; order, nondeterminism and concurrency require additional modeling. This test is strong evidence for selected inputs; only a formal argument plus verified premises could prove a property for an unbounded set. Use property-based and differential tests with shrinking as available.

### Compatibility classes

| Classification | Meaning | Transform permission |
| --- | --- | --- |
| `exact` | Semantics have a tested, lossless mapping for the subset | Candidate for checked automatic emission |
| `conditional` | Mapping is valid only with stated premises and checks | Explicit opt-in, runtime guards and review |
| `lossy` | Meaning cannot be fully preserved | No automatic edit; diagnostic/preview only |
| `unsupported` | No validated mapping exists | Reject, preserve source unchanged |
| `unknown` | Adapter cannot establish behavior | Reject, preserve source unchanged |

"Exact" means *within the stated model*; it is not a claim of universal equivalence. There is no option to bypass unsupported statements because an AI model sounds confident.

## Rhen Bridge: import, inspect, transform, export

**Initial target:** pure, statically typed TypeScript functions using number operations only after explicitly specifying numeric compatibility. To avoid accidental changes to JavaScript's IEEE-754 behavior, prefer a restricted subset using branded checked-integer helpers or exact representable operations, otherwise classify as conditional/unsupported. Start with inspection before any write.

The first adapter should handle:
- Local function declarations, named inputs/outputs, pure literals, arithmetic with explicit numeric assumptions, local immutability, simple branches and return values.
- Exclude dynamic property access, prototype mutation, eval, decorators, getters with side effects, overload ambiguity, async callbacks, exceptions outside mapped error model, ambient globals, reflection, third-party packages and external mutation.
- Preserve or report trivia, source spans and graph dependencies. Never silently drop comments or type annotations.

**Protocol phases:**

1. **Discover:** parse and inventory target project with no writes.
2. **Classify:** report exact/conditional/lossy/unsupported nodes and why.
3. **Propose:** form a declarative transformation plan for bounded regions.
4. **Preflight:** validate input SHA, permissions, versioned semantics, type/effect preconditions, supported mapping and expected invariants.
5. **Preview:** generate a unified diff, mapping report and expected tests; no file changes.
6. **Apply:** explicit user action; atomic guarded writes only if files are unchanged, plus backups/rollback or Git diff support.
7. **Verify:** reparse, retypecheck, rerun targeted tests, report observed results and differences; do not hide failing tests.

### Proposed transformation plan (illustrative, not yet executable)

```json
{
  "protocol": "rhen.transform.v1",
  "adapter": "typescript@0.1",
  "workspace": "local",
  "target_files": [
    {"path": "src/math.ts", "sha256_before": "<digest>"}
  ],
  "intent": {
    "kind": "rename-symbol",
    "symbol": "src/math.ts#function:calculateArea",
    "new_name": "area"
  },
  "preconditions": ["symbol-resolves-once", "no-unhandled-references"],
  "claims": {
    "semantic_compatibility": "exact",
    "tests_required": ["typecheck", "unit:math"]
  },
  "apply": false
}
```

This plan is data, not a shell command or arbitrary model-executable script. Unknown fields and unsupported operations fail validation. `apply=false` is the default; no edit is authorized by generating a plan. A plan must never be trusted merely because a hash or model-supplied status appears in its JSON. The implementation must recompute digests and validate the actual source and tests.

## Optional AI interface: one trusted path

Human, IDE extension, scripting client and AI model all produce the same **untrusted proposed plan**. The deterministic Rhen validator is the trust boundary. Model prose cannot change source, assert successful tests, grant capabilities or create a proof. The model may ask for a bounded inspection, but untrusted repo input is never interpreted as an instruction to the host agent.

AI transport optimizations belong in a separate, optional compact representation with versioned round-trip canonicalization. Preserve a readable, public equivalent. Do not optimize syntax to reduce tokens without first comparing actual accuracy, correction cost and comprehension.

## Interop outward: modules, linking and host boundaries

For host APIs, prefer explicitly typed interfaces and capability declarations. If WASM components later become worthwhile, align interface exploration with WebAssembly WIT's types, imports/exports and worlds rather than inventing a competing all-purpose ABI. WIT defines component interfaces, **not** arbitrary language-to-language source translation.

Native C, Python modules, Node.js packages and browser APIs need independent FFI/ABI safety contracts. External host functions can be effectful, non-deterministic and unsafe; mark those boundaries rather than importing them as pure operations.

## Hazards to falsify early

- JS `Number` overflow, negative zero, NaN, `BigInt` conversions, signed versus unsigned bit operations.
- Python arbitrary-size integers, truthiness and exceptions against Rhen typed/trap semantics.
- Read order for getters/proxies and implicit calls while analyzing TypeScript or JS.
- Cross-language overflow before/after optimization; optimizer must never lift traps.
- Shadowed names, aliases, macro-generated references and source mapping collisions.
- Encoding/Unicode confusables and byte offset versus character offset mismatches.
- Re-entrant transformations, symlink escapes, path traversal, file races between preview and apply, read-only directories.
- Host capability permissions and untrusted generated code execution.
- User-owned source and private data accidentally copied into public IR/telemetry.

Each hazard needs a specific negative test and a documented supported/unsupported outcome.

## Acceptance gates

**M1A:** a schema validator, independently implemented evaluator for M0 semantics, 50+ fixtures spanning valid and invalid programs, and JS/Python differential execution with consistent defined outcomes. It must retain M0 compatibility or record an intentional versioned break.

**First Bridge read-only slice:** parse a fixed bounded TypeScript suite, output a compatibility matrix and source spans; assert **zero filesystem writes**, reject at least 10 dangerous/unsupported feature families, and reproduce diagnostics across runs.

**First transformation slice:** allow a narrowly scoped rename or pure expression rewrite; require source-hash matching, no automatic application, atomic rollback behavior, source preservation and post-edit verification. No arbitrary "fix the project" operation.

## References

- [Rust compiler representations](https://rustc-dev-guide.rust-lang.org/overview.html)
- [MLIR dialect definition model](https://mlir.llvm.org/docs/DefiningDialects/)
- [Tree-sitter source parser documentation](https://tree-sitter.github.io/tree-sitter/using-parsers/)
- [WebAssembly WIT spec](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)

**Status:** proposed design only. No bridge, CSIR v1 or transformation protocol has been implemented by writing this document.
