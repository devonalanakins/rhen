# RFC 0005 — AI-native semantic transport, incremental context and evidence

**Status:** PROPOSED · **Date:** 2026-11-04 · **Depends on:** [RFC 0001](0001-language-contract.md), [RFC 0002](0002-compiler-bridge-protocol.md), [RFC 0004](0004-validation-and-roadmap.md).

## Aim

An optional machine-efficient protocol should let AI coding assistants and conventional software tools request **precise, bounded semantic facts** and propose **verified changes** without repeatedly sending unstructured repositories or granting special access. Rhen remains fully useful and executable without any AI.

The claim that this approach reduces tokens, errors, cost or time is a **hypothesis**, not a product fact. A semantic graph is not inherently smaller or more effective than source text; serialization, retrieval, caching, model familiarity and context budget determine the outcome.

## Product distinction

There are three separate products within one project:
- **Rhen source language:** written and read by people; clarity takes priority over token minimization.
- **Rhen Core representation:** normative typed semantics for native programs and explicitly supported imported fragments; validates behavior and provenance.
- **Rhen Protocol:** transport for selecting relevant facts, deriving compact representations, proposing transformations and returning evidence. It is not itself an LLM.

Do not conflate a model-generated explanation with a compiler-validated semantic fact. The model can suggest a hypothesis; compiler, type/effect checker and actual tests must establish the checked result.

## Context selection model

The most promising research avenue is **semantic scoping**, not character compression.

Given a developer request, derive:
1. A precise set of referenced symbols and their definitions.
2. The bounded caller/callee and type/effect dependency slice needed for the question.
3. Provenance links to source hashes, files and versioned IR.
4. The exact unsupported or unknown regions, avoiding unsupported assertions.
5. A revision token to invalidate cached semantic context after any source change.

The protocol can return a human-readable summary, canonical structured JSON or a more compact transport. The client can request further context; truncation is always explicit, never a silent loss of relevant semantics.

A change should not be judged safe merely because the protocol omitted inconvenient files. If the dependency graph or effect scope cannot be closed, classify the request as incomplete and refuse an automatic edit.

## Stable identity and hashes

**Proposed identity model:**
- `workspace_id`: opaque local ID; never the owner's public account ID or a path leaked to remote clients.
- `revision`: cryptographic digest of the checked workspace snapshot/manifest, not only a mutable branch name.
- `module_id`: normalized project-relative identity tied to revision and module semantics.
- `symbol_id`: compiler-assigned, revision-scoped ID; stable within a snapshot but not promised stable through arbitrary refactoring.
- `node_id`: versioned IR node reference with origin spans and content digest.
- `capabilities`: requested read/query/test/patch scope, separately granted by trusted host.

Do not treat string-formed IDs or hash fields supplied by a model as authority. Recompute and check against actual source during preflight.

## Protocol proposal

### Read-only query

```json
{
  "protocol": "rhen.protocol.v1",
  "kind": "inspect",
  "revision": "<verified-revision-digest>",
  "request": {
    "symbols": ["module#area"],
    "include": ["signature", "effects", "callers", "definitions"],
    "max_nodes": 200
  }
}
```

### Proposed response

```json
{
  "protocol": "rhen.protocol.v1",
  "kind": "inspection-result",
  "revision": "<verified-revision-digest>",
  "status": "partial",
  "facts": [
    {
      "symbol_id": "s1",
      "signature": "(Rect) -> Int",
      "effects": [],
      "origin": {"path": "src/math.rn", "start_byte": 10, "end_byte": 53}
    }
  ],
  "omitted": [{"reason": "node-limit", "scope": "callers"}],
  "unsupported": [],
  "evidence": {"kind": "compiler-checked", "tool_version": "<version>"}
}
```

These JSON structures are **illustrative schema drafts**; field names are not a stabilized protocol or implemented API. An omission changes the result status to `partial`; a client may not treat partial as complete. Public receipts should omit sensitive source/paths or use an authorized redaction mode.

### Semantic edit lifecycle

`inspect -> select scope -> model/human proposal -> schema validation -> revision/source checks -> type/effect preconditions -> bounded diff preview -> user approval -> atomic write -> source and test verification -> evidence receipt`

- The proposal is always untrusted, including those supplied by a local AI model.
- `apply` is never implied by successful validation or by model confidence.
- If the repository changes between preview and apply, reject and re-inspect rather than forcing a stale edit.
- No secrets or client source leave the local host without explicit opt-in and auditable scoping.
- If tests cannot run, the receipt reports `not_run`, not `pass`.

## Semantic evidence receipts

A useful machine-readable receipt includes:
- Original revision and resulting revision (after apply).
- Adapter/IR/compiler versions and supported semantic subset.
- Exact transformation plan digest and requested effect/capability scope.
- Before/after source files and digests, independently recomputed.
- Typecheck results and diagnostics, exact test commands and observed exit statuses.
- Unsupported/unexamined code regions, omitted context, environment limitations.
- A status such as `verified-for-declared-checks`, `not-verified` or `rejected`.

A receipt does not **certify** that software is secure or correct in all circumstances; it describes evidence for specific checks. Merit could independently consume these receipts later, without becoming a required Rhen runtime dependency.

## Compact transport: separate from semantic truth

Proposed experiment, not a mandatory new syntax:
- Keep **canonical JSON** as the readable interoperability artifact.
- Derive a versioned compact textual form using symbol tables, integer indices, type references and delta updates over a previously validated snapshot.
- Never make a compact form the sole source of truth; round-trip it against canonical IR and verify hashes.
- Reject unknown dictionary entries, mismatched revisions, invalid type refs, partial deltas or unsupported operation codes.
- Compare a binary format only after textual serialization measurements; binary bytes can be expensive or unusable for ordinary model APIs without a compatible transport.

**Critical rule:** compressing source bytes does not necessarily reduce LLM tokens, and a low-token representation may harm correctness if the model has weak familiarity with it.

## Research design: determine if compact semantics actually helps

Compare at least:
A. Plain source with appropriately selected surrounding context.
B. Source plus conventional language-server diagnostics and type signatures.
C. Canonical Rhen semantic JSON for supported programs.
D. Semantically scoped Rhen protocol, human-readable response.
E. Versioned compact/delta form where the model can reliably consume it.

Use identical task pools, corrected context budget accounting, repeated trials, recorded model/tokenizer versions, prompt variants and honest end-to-end timings. Metrics: task completion correctness, repair rounds, total tokens, tool/query calls, response latency, human review cost, unsupported cases and total source provided. Include cases where Rhen loses and explain failure modes.

Use staged evaluation:
1. Can the protocol round-trip canonical facts without information loss in supported semantics?
2. Can a client query a small relevant semantic slice correctly?
3. Can a model understand the slice and make correct bounded edits?
4. Does the method help compared with strong baseline tooling and source selection?
5. Does any gain generalize beyond a particular model/version/task family?

No speculative benchmark numbers belong in the README or social posts. Publish public methodologies before interpreting favorable results.

## AI autonomy and security boundary

Rhen Protocol **cannot** authorize merges, deployments, payments, file writes, source transfers, tests with side effects or execution solely because a model asks. Approval and actual tool capabilities live outside the protocol and must be enforced at the host. Model-facing comments and tool outputs are untrusted. Grant only path-scoped, time-bounded permissions consistent with the user's explicit instruction.

Avoid claiming that static types, signatures, isolation flags or model-safe serialization prevent arbitrary code execution. Host security is a separate engineering discipline.

## What we build first

**Not a chat agent.** Start with a read-only semantic query over the first working typed Rhen program, with deterministic output and a contract test. Only after that works, implement a small query over the external TypeScript subset (read-only). Add models and compact transport *after* the protocol is independently useful to human editors and scripts.

### Acceptance

- Protocol operations have a versioned schema, stable error classifications and input/resource bounds.
- All queries are read-only until an explicit later apply subcommand; tests show no writes.
- Incomplete context is surfaced in status and prohibited from unconditional success claims.
- Workspace and node identities cannot be used to access paths outside granted scope.
- Round-trip property tests verify semantic data across canonical and compact formats before deployment.
- Any claimed efficiency gain has independent task-based experimental evidence.

## Design references

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) for editor-neutral semantic queries (not a replacement for Rhen's transformation contract).
- [MLIR dialect models](https://mlir.llvm.org/docs/DefiningDialects/) for typed operations and extensible models.
- [Rust HIR / MIR overview](https://rustc-dev-guide.rust-lang.org/overview.html) for source-to-semantics representations.

**Status:** PROPOSED. No AI protocol, semantic querying service, compressed transport or benchmark result has been implemented in this RFC.
