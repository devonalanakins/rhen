# Security policy

Rhen M0 is a research compiler prototype, **not** a secure sandbox, production compiler or safe untrusted-code execution service. The CLI parses local input and emits source text; running emitted code is a separate, potentially unsafe choice.

Security issues should be disclosed privately through the repository's GitHub security-advisory channel if enabled, or via a verified private maintainer contact. Do not post exploitable secrets or client records publicly.

M0 bounds source/token/depth, rejects unsupported syntax, does not use remote AI or network access, and never executes emitted source. These design choices do not constitute a security certification.
