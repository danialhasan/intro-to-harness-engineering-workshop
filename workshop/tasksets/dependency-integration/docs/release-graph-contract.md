# Release graph contract

- Include every enabled service exactly once.
- Release each enabled dependency before the service that requires it.
- Exclude disabled services.
- Reject an enabled service that depends on a missing or disabled service.
- Reject dependency cycles.
- Preserve declaration order when two enabled services are otherwise independent.
