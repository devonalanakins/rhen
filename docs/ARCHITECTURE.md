# Rhen architecture and research program

Rhen is an independent, human-first language experiment. It is not Anevum fictional canon, Vesper finance, Vesper Legacy trading history, or Merit.

## Research goals, not product claims

1. Readable syntax that humans can learn and modify without AI.
2. A versioned, inspectable program model for machine- and human-directed transformations.
3. Language adapters with explicit, tested semantic boundaries, never silent “works for any language” claims.
4. Quantified model-token costs, corrected-error rates, compilation cost, and human comprehension against realistic baselines.
5. Reproducible local-first and fully open-source tooling.

## Current M0 pipeline

```text
Rhen source (.rn)
       |
       v
scanner / parser / name checks
       |
       v
rhen.ir.v0 (JSON)
       |             |
       v             v
 JS emitter      Python emitter
       |             |
       v             v
target text      target text
```

The compiler does not execute generated source. The M0 subset is integer-only and checks for safe-number overflow in target output. It does not parse existing JavaScript or Python.

## Next verified increments

- Split IR validation, backend emitters, and source parser as tests justify.
- Formalize type/effect semantics, negative conformance fixtures, and source provenance.
- Add functions and immutability to a testable semantic core.
- Write bounded language import adapters, each with supported/unsupported cases and compatibility measurements.
- Compare performance, model efficiency and human comprehension with transparent data and reproducible tasks.
- Consider WASM/native implementation only when measured performance or integration justifies the complexity.

No unconditional future claim about every language, scientific novelty, safety certification, or model advantage. Keep incompatible or unsafe inputs fail-closed.
