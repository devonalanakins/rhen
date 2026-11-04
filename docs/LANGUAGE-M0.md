# Rhen M0 language reference

M0 describes a deliberately small executable subset, not the intended full language.

## Grammar

```text
program   := (NEWLINE | statement NEWLINE?)* EOF
statement := 'let' NAME '=' expr | 'print' expr
expr      := product (('+' | '-') product)*
product   := atom ('*' atom)*
atom      := '-' atom | NUMBER | NAME | '(' expr ')'
NAME      := ASCII letter or '_' followed by ASCII letters, digits or '_'
NUMBER    := one or more ASCII digits, within signed safe-integer range
COMMENT   := '#' followed by non-newline characters
```

A declaration assigns an immutable, source-ordered slot. Redeclaration and use-before-declaration are rejected. Indentation and whitespace carry no semantic meaning at M0; statements require newlines.

## Semantics and limits

- Integer values are restricted to the JavaScript safe integer interval, inclusive, on both JS and Python targets.
- Bound checks occur at each emitted arithmetic operation, including intermediate expressions.
- Multiplication binds more tightly than addition/subtraction; unary minus and grouping are supported.
- Maximum source length: 65,536 UTF-16 code units. Maximum tokens: 4,096 including EOF. Maximum atom nesting: 48.
- Unsupported characters and statements fail with source locations rather than being evaluated or passed through.
- Generated source is text only. The CLI does not execute it or make outbound requests.

## Intermediate representation

`rhen.ir.v0` is deterministic JSON with source-ordered `statements`. Nodes: `Let`, `Print`, `Number`, `Read`, `Binary`, `Negate`. Reads use compiler-controlled integer slots rather than user names, avoiding target-language keyword collisions. The format is an experimental version, not a promised stable ABI.

## Missing capabilities

No functions, conditionals, loops, strings, float math, modules, types/effects, symbolic/tensor mathematics, importing other languages, optimizer, source maps, formal correctness proofs, compiler packages, or runtime sandbox. Emission to two target languages is **not** evidence of general cross-language interoperability.
