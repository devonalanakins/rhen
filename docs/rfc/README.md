# Rhen design review — master index

**Status: PROPOSED ONLY · November 4, 2026.** All of these RFCs are independent architectural proposals intended for review. They do not expand the actually implemented feature set of M0, do not grant a license, and do not constitute release approval.

## The complete Rhen vision

> **Write programs humans understand. Represent meaning tools can inspect. Transform supported code across languages without hiding uncertainty.**

Rhen is **one** independent, open-source-intended programming-language research project in [devonalanakins/rhen](https://github.com/devonalanakins/rhen). It must remain separate from [Vesper](https://github.com/devonalanakins/vesper) (financial research redesign), [Vesper Legacy](https://github.com/devonalanakins/vesper-legacy) (historical trading source), [Merit](https://github.com/devonalanakins/merit) (software engineering integrity), and fictional Rhen/Transcosmic content.

## Read the RFCs in order

| RFC | Topic | Core decisions under review |
| --- | --- | --- |
| [0001](0001-language-contract.md) | Language constitution & semantics | Readable syntax, explicit typed operations, checked integer semantics, immutable values, effects, error model |
| [0002](0002-compiler-bridge-protocol.md) | Compiler, semantic IR & Bridge | Layered representations, source provenance, typed CSIR, admitted-language subsets, compatibility reports, guarded edits |
| [0003](0003-tooling-ecosystem-safety.md) | Developer tooling & safety | Offline CLI, reproducible packages, LSP, contributor governance, untrusted-source handling, open-source release constraints |
| [0004](0004-validation-and-roadmap.md) | Research & staged delivery | Differential reference tests, AI/human benchmarks, falsification, implementation gates and year-end/2027 sequencing |

## One-system architecture

```text
Human-written .rn    External code (initially limited TS subset)
        |                         |
  Rhen parser               Bridge adapter / reports
        |                         |
      typed HIR <------------ supported constructs only
        |
  validated Core Semantic IR
        |          |                 |
  reference     target backends   guarded transform plans
  evaluator      JS / Python      preview -> user gate -> edit
        |
 deterministic tests, source provenance and evidence
        ^
 optional AI client may suggest, never bypass validation or approval
```

**Research hypothesis:** a semantic representation might improve the accuracy and transparency of cross-language manipulation and optional AI-assisted coding. The word "might" matters; no quantitative advantage or all-language compatibility is verified.

## Status ledger

| Element | Status as of 2026-11-04 |
| --- | --- |
| New independent Rhen repository | **VERIFIED**; GitHub repo ID 1445605353 |
| M0 scanner/parser, `.rn` integer subset and JSON IR | **IMPLEMENTED IN DRAFT PR #1** |
| M0 JS/Python source emission and local CLI | **IMPLEMENTED IN DRAFT PR #1** |
| M0 10 local tests and two exact-head CI runs | **VERIFIED** at commit `9d9e5a784ec0` |
| Typed Rhen v0.1 language, checked i64 | **PROPOSED** |
| Reference evaluator, CSIR v1 and semantic schemas | **PROPOSED** |
| Language import, Bridge transforms, source-preserving patches | **PROPOSED** |
| Offline full CLI, LSP, packages and optional AI protocol | **PROPOSED** |
| AI efficiency / superior human readability | **UNTESTED HYPOTHESES** |
| MIT license and release/merge approval | **PENDING OWNER REVIEW** |
| Production compiler, hosted service or package release | **NOT AVAILABLE** |

M0 [draft PR #1](https://github.com/devonalanakins/rhen/pull/1) is open. This design should be reviewed on a separate draft PR **stacked on M0**, not merged ahead of M0 or represented as code.

## Candidate technical defaults, to decide deliberately

1. Readable source language with braces, `let` immutability, typed `fn` public signatures, pattern matching and ordinary type inference within functions.
2. `Int` as checked signed i64 only after a versioned migration from M0's 53-bit safe-number contract; no implicit numeric coercions.
3. Pure functions by default; effects explicit in signatures, external host capabilities separate from source.
4. Source CST + typed HIR + versioned CSIR for separate editing, analysis and code generation needs; start with the smallest layer that provides independently testable benefit.
5. JavaScript/Python backends for defined subsets; TypeScript read-only Bridge first; optional WASM after user demand and tests.
6. AI transport as optional client of the **same guarded plan API**, never an implicit privileged execution engine.
7. No custom VM, dependency registry, mandatory SaaS, LLVM/MLIR installation or Rust rewrite during the early semantic-clarification phases.
8. Actual open-source license requires owner approval. Documentation does not authorize release.

## Foundational invariants to protect during implementation

- A program is rejected if unsupported semantics cannot be established; no "best guess" accepted into a safe transformation.
- Generated JS/Python must match defined observable results and errors on the admitted subset.
- No bridge inspection modifies files.
- A generated transform plan is not an instruction to apply; its digest, spans and semantic claims must be revalidated against current sources.
- AI, local scripts and human-authored edits use identical validation and approval boundaries.
- User-controlled code and external files remain untrusted; effects and type systems are not stand-alone sandboxes.
- Any emitted performance/readability/security claim refers to observed, reproducible evidence, not a model prediction.
- Rhen remains useful without an AI model, cloud provider or third-party service.

## First shippable engineering increment

1. Independent audit of M0 PR #1, including JavaScript/Python integer, source escape, parser limit, and observable `print` trace behaviors.
2. Decide the open-source license; merge M0 only after review and exact-head CI.
3. Add **M1A only** as a separate PR: versioned M0 IR validation, reference evaluator and 50+ cross-target golden fixtures including 20+ negative cases.
4. Keep new language syntax and TypeScript imports out of M1A; use research RFCs to justify the next implementation rather than guessing.

## Primary architectural references

- [Rust compiler overview](https://rustc-dev-guide.rust-lang.org/overview.html)
- [MLIR dialect definitions](https://mlir.llvm.org/docs/DefiningDialects/)
- [Tree-sitter parsing](https://tree-sitter.github.io/tree-sitter/using-parsers/)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [WebAssembly WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)

**Governance:** Discuss and accept or reject proposals in their own RFC/PR review. Acceptance does not establish an implementation; passing CI does not establish correctness of general language semantics or production readiness.
