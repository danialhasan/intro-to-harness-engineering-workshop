# Retry-safe HTTP client specimen

## Task

The shared request helper retries temporary failures. It now supports two real
callers:

- `GET /catalog`: safe to retry after a temporary `503`.
- `POST /jobs`: the server can create a job and then lose its response. It is
  unsafe to retry this operation automatically.

Change the participant-owned code in `src/` so it obeys the API contract and
records each physical HTTP attempt. Do not edit `verifier/` or `reference/`.

Read these files before editing:

1. `docs/api-contract.md`
2. `src/http/request.ts`
3. `src/clients/catalog.ts`
4. `src/clients/jobs.ts`
5. `src/telemetry.ts`
6. `test/scripted-transport.ts`

## Commands

```sh
npm install
npm run check
npm test
npm run eval
```

The starting implementation is intentionally realistic but incorrect, so
`npm test` and `npm run eval` begin RED. The fixed reference can be checked
without changing participant code:

```sh
npm run eval:reference
```

For a read-only audit of a saved implementation, pass its absolute
`src/http/request.ts` path to the fixed evaluator:

```sh
npm run eval -- --implementation-path /absolute/path/to/src/http/request.ts \
  --report /absolute/path/to/audit-report.json
```

To restore the starting participant helper:

```sh
npm run reset
```

## Boundary

`src/` and `test/` are the participant-facing surface. `verifier/` is a fixed
acceptance evaluator. This local repository cannot technically prevent edits to
the evaluator; the workshop rule is that it is not participant-editable.

The evaluator checks an engineering outcome, not a single score:

- bounded retries and fake-clock backoff for the safe catalog read;
- no automatic duplicate job creation after a lost `POST` response;
- exactly one trace record per physical request attempt.
