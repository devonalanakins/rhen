# Rhen SafeInt semantic evidence — experimental

Status: implemented in draft PR, unmerged; not a stable language ABI or release.

The read-only exportTypedSemanticEvidence function in src/semantic-evidence.mjs produces a merit.evidence.v1 packet for rhen.typed.preview.v0. It requires explicit repository, revision, claim, policy digest, run ID, timestamp and predicate.

It hashes the exact UTF-8 input, a validated typed IR, and generated JS/Python artifacts. Only the Rhen reference evaluator is executed. Its ordered output and checked overflow/budget traps are recorded. The packet includes outstanding obligations for an independent oracle and actual JS and Python execution.

All source revision, policy and run identifiers are caller-supplied assertions, not authenticated provenance. Do not interpret this packet as proof of backend equivalence, universal language interoperability or release authorization.

Run npm run check and npm test. The Merit draft integration workflow checks out pinned Rhen commit 827d5640da195d06f88321a7e0c5d386845027cc and executes the controlled cross-project experiment. Rhen has no Merit runtime dependency.

Unimplemented: signed provenance, general language adapters, source maps, canonical cross-language hashing, stable checked-i64 semantics and formal correctness proofs.

The first pinned experiment reads examples/merit-safeint-boundary.rn directly from that Rhen revision; the source is not attributed to an unrelated repository or uncommitted test string.
