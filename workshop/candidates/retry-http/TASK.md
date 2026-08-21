# Task: make retry behavior safe and observable

The client must recover a temporary catalog-read failure without creating an
unsafe duplicate job when a create request loses its response. It must also
make each physical HTTP attempt visible in the attempt trace.

The engineering outcome is complete only when the fixed evaluator passes.
`verifier/` and `reference/` are immutable workshop boundaries. Do not edit
them. The evaluator reports the acceptance result; the reference is a fallback,
not participant code.
