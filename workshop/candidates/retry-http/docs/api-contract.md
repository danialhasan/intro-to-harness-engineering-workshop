# API and retry contract

## Catalog read

`GET /catalog` is a read-only operation. It is safe for this client to retry a
temporary `503` response. Make at most three physical attempts total. Between
failed attempts, wait with the injected clock for 100 ms and then 200 ms.
Do not retry other HTTP status failures, including `500`; surface them after
their first physical attempt.

Expected scripted sequence:

```text
503 -> 503 -> 200
```

## Job creation

`POST /jobs` creates a job. The service can commit the new job and then lose
the response on the network. A lost response means the client does not know
whether the server applied the request. This client has no idempotency key or
deduplication contract for job creation.

Therefore the shared helper must not retry this operation automatically after a
lost response. Surface the error to the caller after its one physical attempt.

## Attempt trace

Every physical request attempt must create one trace record. A retry is a new
physical request, so it creates a new trace record. Each record includes:

- operation name;
- method;
- one-based attempt number;
- `success` or `failure` outcome.

Use the injected fake clock. Do not add real sleeps or network access.
