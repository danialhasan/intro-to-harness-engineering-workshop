# Release completion contract

- Required checks are `build`, `test`, and `security`.
- Every required check must exist and report `pass`.
- The produced artifact digest must match the approved digest.
- A blocked decision must not contain a release marker.
- A ready decision uses the marker `release:<approved digest>`.
