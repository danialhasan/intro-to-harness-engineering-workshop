# Import service contract

- Send imports to `/v2/records`.
- Identify the tenant with the `x-tenant-id` header.
- Reject a blank tenant ID.
- Send at most 50 records in each batch.
- Preserve the original record order across batches.
- An empty record list produces no batches.
