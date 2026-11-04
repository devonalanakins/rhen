# RFC 0004 — Verification, research protocol, delivery gates and adoption

**Status:** PROPOSED · **Date:** 2026-11-04 · **Depends on:** [RFC 0001](0001-language-contract.md), [RFC 0002](0002-compiler-bridge-protocol.md), [RFC 0003](0003-tooling-ecosystem-safety.md).

## Central hypothesis, in falsifiable form

A language with a human-readable surface and an explicit, versioned semantic core may improve reliability of program understanding and transformation without requiring its users to abandon existing languages. Its optional structured protocol **may** improve outcomes of AI-assisted engineering, but that advantage must be established against competitive baselines.

Three independent claims need different evidence:

| Claim | Minimal evidence | Disconfirming result |
| --- | --- | --- |
| Readable | Other developers can explain/debug/write useful code without assistance | Worse comprehension or higher correction time than comparable alternatives |
| Correct / portable subset | Reference evaluator, JS and Python targets agree on supported semantics, including errors | A counterexample where admitted programs differ |
| Effective AI transport | Same-model repeated trials: correctness-adjusted token/latency/human-time improvement versus well-specified Python/TS baselines | No statistically and practically meaningful gain, or worsened correctness |

Do not collapse engineering conformance into formal proof, or benchmark advantage into global superiority.

## Evidence taxonomy

1. **Specification:** normative semantics with reviewed counterexamples; explains what is intended.
2. **Implementation:** exact commit, source files and documented target constraints; shows code exists.
3. **Test evidence:** reproducible command, environment, inputs, failure assertions and observed outputs.
4. **Differential evidence:** same admitted program and inputs checked against independent evaluator and multiple targets.
5. **Security evidence:** defined threat model, adversarial inputs, dependency review, bounded host permissions, rollback test.
6. **Research evidence:** predeclared protocol and baselines, raw anonymized results, statistical uncertainty and limitations.
7. **Release evidence:** versioned binaries/packages, checksums, license, changelog, exact-head CI and reproduction instructions.

Passing a unit test or generated evidence receipt is not a security certification or proof that a deployed version is safe.

## Independent M0 audit gate — before merge

Existing [Rhen draft PR #1](https://github.com/devonalanakins/rhen/pull/1) has exact-head success at `9d9e5a784ec091310c1ab9ca1dbe526a19f38e47`, following a fixed source-escape issue. Review this code independently rather than treating green CI as full acceptance.

- Reproduce syntax check and 10 documented tests with current Node/Python versions; record environment.
- Walk source parser, name resolution, arithmetic bounds, generated JS/Python and CLI error path.
- Add adversarial fixtures for EOF/newline, CRLF, comments, long identifiers, tabs, source-size accounting, unary/minus depth, overflow under nested operations, duplicate names, cyclic-like initializer references and weird keywords.
- Independently reason about each generated target's evaluation and error behavior.
- Check generated-code injection surfaces and whether source user names remain isolated from generated identifiers.
- Verify no network/deploy/financial runtime integration; test commands should not require secret credentials.
- Choose and explicitly approve the license; do not auto-merge for a roadmap milestone.
- If material defects exist, fix M0 before extending it. Record release gate as NO-GO until resolved.

## M1A acceptance: stable semantic test oracle

**Build:** independent IR schema validator; a separate reference evaluator for the existing admitted M0 subset; test fixtures including source text, parsed IR, result or explicit error, and target observable behavior.

**Invariants:**
- No unchecked/malformed/unversioned IR ever reaches an emitter.
- Program and expression order, `print` effect trace and errors are represented consistently. The M0 `print` statement is an observable effect and cannot be omitted from the equivalence model.
- Numeric constraints match the current M0 signed JS-safe range until a distinct, versioned i64 migration is approved.
- A failing source or target must not output a fabricated success receipt.
- The fixtures are golden, independently inspected, and deterministic across locales/OS for the supported subset.

**Gate:** At least 50 diverse fixtures, including 20+ negative cases, across reference evaluator, JS and Python. At least one property-based generator constrained to valid small programs, with seed and shrinkable counterexamples. Resource budgets, stage limits and error taxonomy are tested. Exact counts are initial coverage thresholds, not proof of completeness.

## M1B acceptance: useful typed language slice

**Build:** explicit `Int` semantics under a new edition (recommended checked i64), typed pure functions, branching, immutable records, basic lists, `Option`/`Result`, and readable compiler diagnostics.

**Gate:** Two nontrivial reference programs (e.g., a deterministic small CSV/statistics processor and a pure rule validator); independently tested inputs and errors; generated targets agree on defined outputs and traps; the public tutorial is sufficient for a developer unfamiliar with the author. Source semantics, integer migration and serialization formats must be versioned. No normal IO without a separate host capability model.

## M1C acceptance: local-first usable tool

**Build:** local `rhen init/check/test/run/build/fmt` where each actually does what it claims. Explicit host capabilities, opt-in filesystem access, edition-aware modules, deterministic build outputs and helpful error messages.

**Gate:** A developer can follow a clean-room getting-started document from clone to a small CLI application without AI or cloud access; tests pass on at least Linux/macOS/Windows using available CI matrix or documented local environments. The emitted target runtimes require independent behavioral validation.

## M2A acceptance: TypeScript inspection, read-only

**Build:** a restricted TypeScript importer/compatibility engine. Initial supported subset: pure functions, bounded arithmetic, local immutable bindings and typed returns with explicit numeric conditions.

**Gate:** Published compatibility table, correct parsed source spans, unchanged source hashes before/after inspection, negative tests for getter side effects, proxies, dynamic operations, async/exceptions and dependencies. Missing types or semantic information are `unknown` or `unsupported`, never silently accepted.

## M2B acceptance: first guarded rewrite

**Build:** a deterministic rename-symbol or pure-expression rewrite in the supported TypeScript subset, with preview, complete reference inventory, source digest guard, rollback and source-preserving edits.

**Gate:** Source files are unchanged without an explicit apply request. Read-only CI verifies plan/diff before editing. Conflict between plan and current bytes fails; partial edits restore original state. Reparse/typecheck/tests run after applying when available, and failures remain visible. No AI-specific bypass.

## M3 acceptance: optional AI protocol

**Build:** structured read-only semantic queries plus bounded transformation proposals. Expose exactly the deterministic plan/validation path human tools use. Client may be local and self-hosted; no external AI dependence.

**Gate:** Malicious or misleading model instructions cannot cause file writes, shell execution, network transfer, capabilities expansion or forged evidence through the protocol. Prompts/documents/comments are treated as untrusted data; model output validated by schemas. No benchmark release until protocol itself is reproducible.

## M4 acceptance: developer ecosystem

**Build:** stable edition/reference documentation, local language server via LSP, modules and reproducible packages, minimal standard library, independent real-world applications; optional WASM or other native target only if evidence warrants it.

**Gate:** Non-author contributors can build, understand and fix examples; security policy and license established; release candidate reproducible; no enterprise/financial/clinical integrations inferred from generic compiler capability.

## Research protocol A — compiler differential semantics

**Subjects:** stratified generated programs from the supported grammar; hand-authored edge cases; metamorphic variants that preserve known semantics.

**Tests:** compare independent reference evaluator and target executions under fixed runtime versions, environment, locale, input and resource budgets. Compare value types, checked arithmetic, errors, stdout/stderr, and declared effects; normalize only intentionally irrelevant details. Do not normalize away meaningful differences.

**Reproducibility:** publish generator version/seeds, fixtures, shrinking strategy, per-program outcome, target command/version, exact commit and known limitations. Any found disagreement is a regression issue and may block expansion of the admitted subset.

## Research protocol B — AI-assisted engineering effectiveness

**Primary question:** does Rhen's readable language and/or structured protocol improve correctness-adjusted AI engineering outcomes against comparable workflows?

**Initial pilot:** approximately 20 realistic tasks spanning parsing, arithmetic/data handling, refactoring and tests; multiple repeated runs at controlled model/effort configurations. This is a feasibility pilot, not a population-level proof.

**Conditions:**
1. Ordinary TypeScript workflow with standard source and tests.
2. Ordinary Python workflow with comparable source and tests.
3. Rhen source workflow (when language feature parity supports the task).
4. Rhen protocol/Bridge-assisted workflow over existing source (when the adapter supports it).

Do not force tasks into a language that cannot express them: report missing capability as a result. Fix prompts, budgets and tool access as closely as practical; randomize task order; record model/version, settings, attempts and tool use; use blinded or independent code review where possible. Repeat across more than one model when resources allow to reduce vendor/model idiosyncrasy.

**Metrics:** first-try correctness on hidden tests; final correctness after capped repair rounds; tokens input/output; latency; total cost when applicable; human review/correction minutes; frequency/severity of semantic mistakes; refusals/unsupported cases; and amount of code changed. Report distributions, uncertainty intervals and failure cases. Optimize **correctness and human effort jointly**, not raw token count.

**Avoid common errors:** a popular language may perform better simply because the model has more training examples; tokenizers are model-specific; human prompts are not equivalent tasks across language abilities; repeated attempts are not independent users. Results from one model/date do not prove general AI efficiency.

## Research protocol C — human readability and learning

Recruit participants across experience bands. Compare matched, functionality-equivalent short programs in Rhen, TypeScript and Python. Use within-subject counterbalanced task order where feasible; control familiarity and tutorial exposure.

Tasks: predict behavior, locate a defect, explain a function, perform a change, re-read after a delay. Measure time, correctness, comprehension, corrections, confidence calibration and subjective workload separately. Pilot feedback is qualitative; publish transparent limitations and do not claim broad population validity from a small group.

## Risk register and safeguards

| Risk | Early signal | Control |
| --- | --- | --- |
| Syntax novelty without value | Familiar program longer/harder than Python/TS | Usability review before adding syntax |
| Universal-translation overclaim | Adapter accepts unknown semantics | Explicit rejected/conditional status and negative cases |
| M0 numeric drift | JavaScript/Python disagree on large integers | Versioned i64 decision and differential fixtures |
| AI-specific privilege escalation | Model can write files or run tools unreviewed | Same deterministic host gate as human clients |
| Security theater | "Effects" marketed as sandbox | Host-enforced grants and separate security audit |
| Ecosystem burden | Months spent on registry/editor before useful programs | Defer infrastructure until real evidence of demand |
| Contributor fragmentation | Multiple competing repo identities | One source of truth; RFCs and edition rules |
| Overcommitment | Compiler work displaces family and paid priorities | Bounded increments and explicit pause/review gates |
| Benchmark cherry-picking | Only successful cases published | Predeclare tasks and publish failures/repeats |
| License uncertainty | Draft LICENSE mistaken for approved grant | Owner approval and exact merged license verification |

## Stage plan: November 2026 through December 2027 (not a deadline promise)

| Window | Focus | Review gate |
| --- | --- | --- |
| November–December 2026 | M0 audit, licensing decision, M1A schema/evaluator; first public research notes only after approval | Golden conformance and exact-head CI |
| Q1 2027 | M1B: typed function/data subset, predictable arithmetic and diagnostics | Two meaningful nontrivial programs, negative cases |
| Q2 2027 | M1C local-first CLI and M2A read-only TypeScript bridge | Clean-room tutorial + compatibility report |
| Q3 2027 | M2B guarded transformations; preregistered AI/readability pilot | Independent source preservation and evidence |
| Q4 2027 | M3 protocol research, editor foundations and public annual analysis (if preceding gates pass) | Report real findings, no fictitious product release |

Milestones are dependent on verified technical acceptance, maintainer capacity and existing priorities; dates communicate planning order, not promises. The more useful next deliverable is *the next passing testable slice*, not a speculative v1 ship date. A one-million-follower social stretch goal is not a reason to overstate technical releases.

## Public adoption and credibility

Publish original language experiments under a stable open repository, correct source links, clear reproductions and honest limitations. Encourage third-party bug reports and independent attempts to reproduce transformations. Earn adoption through genuinely useful tooling rather than general claims that Rhen is the fastest, most advanced or universal language.

Potential first use case: read-only TypeScript safety/compatibility inspector, even before Rhen becomes a general-purpose language. If that tool is useful to developers who never adopt Rhen syntax, the interoperability thesis has independent value.

## Next bounded change

After reviewing and approving the M0 license and independent source audit, implement **M1A only**: IR validator + reference evaluator + differential fixtures as a small, separately reviewable PR. Keep the existing M0 code and branch history intact.

**This RFC is a research and delivery design, not executable code, a benchmark result, or an approval to merge/deploy.**
