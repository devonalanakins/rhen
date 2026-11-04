# RFC 0003 — Developer experience, toolchain, ecosystem and operational safety

**Status:** PROPOSED · **Date:** 2026-11-04 · **Depends on:** [RFC 0001](0001-language-contract.md), [RFC 0002](0002-compiler-bridge-protocol.md).

## Product UX principle

Rhen must be pleasant to develop in **before** it claims to be innovative: one coherent CLI, readable diagnostics, good documentation, predictable builds, and a straightforward route from small examples to useful applications. Tooling must not require an AI account, cloud compiler, proprietary SaaS, or hosted package registry.

The first user journey:
`install from open-source release -> rhen init -> write source -> rhen check -> rhen test -> rhen run -> inspect output`.
The first existing-project journey:
`rhen bridge inspect -> compatibility report -> preview transform -> explicit apply -> tests/diff`.

Current M0 offers only `node bin/rhen.mjs <file.rn> --target ir|js|python` and its tests. The commands below are an interface design, **not currently implemented**.

## Proposed CLI contract

| Command | User result | Default side effects |
| --- | --- | --- |
| `rhen --version` | Compiler and protocol versions | None |
| `rhen init [dir]` | Reproducible sample project after confirming existing paths | Creates a new directory only |
| `rhen fmt [paths]` | Canonical formatting | Check/preview by default; `--write` explicit |
| `rhen check [path]` | Syntax, type, effect, compatibility diagnostics | Read-only |
| `rhen test [path]` | Isolated local unit tests, structured results | No network unless explicitly granted |
| `rhen run [entry]` | Executes a reviewed Rhen program using a selected host | Explicit process execution; capabilities refused unless granted |
| `rhen build --target js|python` | Target source/artifact in declared output directory | Writes build output only |
| `rhen inspect --stage cst|hir|csir` | Human-readable and machine-readable versions | Read-only |
| `rhen bridge inspect --lang ts <dir>` | Supported/conditional/unsupported breakdown | Read-only |
| `rhen bridge plan <intent>` | Versioned, guarded patch plan + diff | Read-only |
| `rhen bridge apply <plan>` | Writes only after explicit confirmation, hash check and backups | Guarded write |
| `rhen verify <receipt>` | Checks actual source/tests, does not trust supplied assertions | Read-only unless test run explicitly authorized |

**Machine mode:** `--format json` writes well-specified, versioned JSON to stdout while human explanations go to stderr. Nonzero exit codes are stable and distinct for usage, syntax, type, compatibility, input limits, test failures and tool/system failures. Command output cannot claim "verified" when tests were merely requested or skipped.

**No magical AI commands:** model clients access a separate opt-in protocol that can propose transformations but cannot bypass the same CLI validator, source-hash preconditions, checks or human confirmation.

## High-quality diagnostics

Design an error such as:

```text
error[RHE-T013]: Int and Float64 cannot be added implicitly
  --> src/report.rn:18:22
   |
18 | let total = count + ratio
   |                      ^^^^^ Float64
   |             ^^^^^ Int
   |
help: convert explicitly with Int.to_float() or revise the formula
note: no source changes were made
```

Required fields: stable diagnostic code, severity, source path, span in bytes and display columns, message, related spans, suggested fix (if provably safe), and machine-readable schema. Unicode wide characters, combining marks, tabs, emojis, CRLF and redacted paths need careful tests. Never emit stack traces or internal filepaths for routine user errors by default.

A fixer must be deterministic and reversible. Hints are not automatic edits.

## Proposed project layout

```text
my-project/
├── rhen.toml
├── rhen.lock
├── src/
│   └── main.rn
├── tests/
│   └── arithmetic_test.rn
└── examples/
    └── report.rn
```

### Proposed manifest

```toml
[package]
name = "example/report"
version = "0.1.0"
edition = "preview-2027"
license = "MIT"

[build]
target = "js"

[capabilities]
filesystem_read = []
network = false

[dependencies]
# Empty by default; local path dependencies supported before a registry.
```

Before a registry, support vendored/local path modules and deterministic builds. A lockfile must record exact source revisions, canonical content digests, target/edition, dependency graph and tool version. Digests alone are integrity hints, not proof of publisher identity. Package fetching stays offline unless explicitly requested.

**Do not invent a public registry in v0.1.** A secure registry requires substantial identity, trust, deletion/yank, signing, malware, funding and supply-chain policy work. Accept manual source dependencies first.

## Proposed module and package semantics

- A module is a source file or declared module tree with deterministic import resolution.
- `pub` declares exported symbols; hidden internal symbols are not importable by ordinary packages.
- No wildcard imports or implicit package-global namespace mutation in initial releases.
- Cyclic dependencies are rejected unless a future formal rule handles them.
- Public ABI/API compatibility is evaluated from exported types, effects and semantic constraints, not function names alone.
- Lockfiles are versioned and hashed in CI; build provenance includes compiler edition and dependencies.
- Version policy: experimental 0.x editions may have explicit breaking changes; after stable 1.x, semantic compatibility has review gates, migration tools and deprecation notices.

## Tooling and editor integration

**Phase 1:** TextMate-style syntax grammar, Markdown documentation, example programs, `rhen fmt --check`, `rhen check --format json`. Editor-neutral basic support first.

**Phase 2:** One local language server speaking the open Language Server Protocol, supplying diagnostics, completion, hover types, go-to-definition, find references, rename preview and semantic tokens. The official LSP defines a reusable editor/server interface; no proprietary editor should be required.

**Phase 3:** A local offline playground with a worker/process resource budget and no arbitrary untrusted host execution, then an optional self-hostable documentation/demo website. A browser sandbox is not by itself proof of safety; default to evaluating a pure subset in a bounded interpreter and explicitly disable unapproved host capabilities.

**Phase 4:** Debugging, refactoring and source-to-source Bridge previews in editors; performance tooling and specialized domain modules only after real users need them.

## One repository first

Maintain **one canonical Rhen GitHub repo**, currently `devonalanakins/rhen`. Split code into internal modules/packages when tests and dependency boundaries demand it, rather than opening additional services or repositories for appearance.

Proposed eventual directory ownership:

```text
rhen/
├── docs/
│   ├── rfc/                  # design proposals
│   ├── spec/                 # only approved normative specifications
│   └── guides/               # tutorials and reference
├── src/
│   ├── frontend/             # syntax and resolution
│   ├── semantics/            # typed HIR and capability checker
│   ├── ir/                   # schema and validators
│   ├── evaluator/            # reference oracle
│   ├── backends/             # js, python, future wasm
│   └── bridge/               # bounded adapters
├── bin/                      # CLI
├── tests/
│   ├── conformance/
│   ├── differential/
│   ├── negative/
│   └── golden/
├── benchmarks/               # fair public evaluation suite
├── examples/                 # real applications, versioned
└── editors/                  # portable editor grammar/LSP
```

This tree is **proposed**, not an instruction to relocate the existing M0 implementation now. Use small PRs and preserve known passing test paths.

## AI interface security

Rhen Protocol is a local, optional integration boundary: clients can request readonly semantic facts; submit declarative transformation plans; receive schema-validated diagnostics/diffs; and optionally request test execution with user authorization. The AI client has no privileged special-case API.

- Source files, tool outputs, comments and dependency metadata are **untrusted data**, never privileged instructions.
- No source uploading to a remote model by default. Any such transfer requires explicit user opt-in and scope.
- The verifier never trusts a model-supplied "tests pass" statement. Results are tied to actual exact source revision, environment and command evidence.
- Execute generated code only in an appropriately configured, constrained environment after authorization. Even sandboxed code may exhaust resources or exploit host vulnerabilities.
- Transformation writes must be atomic, race-checked, path-scoped and reversible; symbolic links, path escapes and incomplete workspaces are unsafe by default.
- Capabilities must be granted by the host/user outside the source text. A declaration does not confer rights.
- Never store secrets in public IR, audit events, model prompts, logs, crash reports or example files.

## Security model and limits

The compiler processes potentially malicious inputs, so its scanner/parser/schema validator must bound resource consumption, nesting, file size and recurrence. Treat IR from adapters or models as untrusted serialized input; validate before code generation. Enforce path hygiene, safe output directories and dependency-supply-chain provenance.

Static type checking and effect signatures do **not** prove safe execution. JavaScript/Python output executes with the rights of the chosen runtime unless a separate host enforces limits. State that explicitly in documentation and diagnostics.

No spontaneous network service, telemetry collection or accounts. Any optional analytics must use privacy-respecting opt-in and never include source contents by default.

## Contributor/governance model

- Public governance: RFCs, issue templates for language proposals and compatibility bugs, reviewed PRs, reproducible CI and changelogs.
- Separate statuses: `PROPOSED` RFC, `ACCEPTED` normative semantics, `IMPLEMENTED` code, `VERIFIED` tests, `RELEASED` package, `DEPRECATED` with explicit migration path.
- RFC authors must describe alternatives, trade-offs, counterexamples and rollback/versioning considerations.
- AI-authored or generated contributions are reviewed against independently written acceptance tests. A green AI-authored test suite is not sufficient proof.
- Contributors retain credit and compatible copyright/licensing provenance; third-party code is not blindly copied from other open-source languages.
- **License is pending owner review:** the existing M0 draft includes a proposed MIT LICENSE file. Do not assert that the owner has approved MIT or that unmerged code has been released under that license. An RFC-only PR does not change license status.
- Protect author privacy, public identity, security disclosures and contributors' identities where required.

## Brand and documentation presentation

**Name:** Rhen (capitalized naturally, never automatically all caps). **Positioning:** independent, open research and engineering, no connection to Vesper's financial product or Anevum's fictional material.

Proposed visual identity: midnight blue/ink background, precise mint/sea-glass green highlights, off-white high contrast typography, technical diagrams and editorial source examples. Not a neon gaming interface; sophisticated motion only on optional product pages, obeying reduced-motion settings.

Top-level README should immediately show: what Rhen does *today*, what is still research, a working local example, exact GitHub test evidence and links to specs. Separate future vision from current command availability. Docs should support keyboard navigation, contrast, screen readers and readable plaintext/code exports.

Website IA when justified: **Learn** (tutorial), **Reference** (semantics), **Research** (benchmarks), **Bridge** (compatibility), **Contribute** (RFCs), **Releases** (source and checksums). No need to buy a new domain or deploy anything merely to complete the design.

## Success check for developer experience

A new contributor with Node installed can clone the repository, follow the exact current README, run M0 tests and understand unsupported constructs without any API key or account. Later, after a stable CLI ships, the same person can complete a native CLI tutorial offline and inspect an external language project read-only without editing it.

## Authoritative inspiration

- [Language Server Protocol specification](https://microsoft.github.io/language-server-protocol/)
- [Tree-sitter parsing docs](https://tree-sitter.github.io/tree-sitter/using-parsers/)
- [WebAssembly WIT specification](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)

**Status:** all commands and developer tooling above are design proposals unless specifically listed in the M0 README as implemented. No new tool, editor or package registry was built by this RFC.
