# Expected output and worked interpretation

Model trajectories are not deterministic. Your action counts and evaluator status can differ from this example. The stable expectations are the artifact shapes, fixed-control checks, and evidence limit.

## Local preflight

The no-model checks end with text similar to:

```text
trace fixture tests passed
resource isolation integration test passed
compare fixture test passed
retry integration smoke passed: ...
```

The retry smoke intentionally evaluates the starter as `FAILED`. The smoke command itself succeeds after it confirms that this evaluator result and the trace files exist.

The basic smoke command prints a JSON object with `runId`, `runDir`, `runnerError`, and `evaluation`. It does not print a fixed completion sentence.

## Model run

Each model command prints a JSON object with generated values:

```json
{
  "runId": "pair-...-baseline-...",
  "runDir": ".../runner/runs/pair-.../baseline/pair-...-baseline-..."
}
```

The run directory contains at least:

```text
comparison-manifest.json
evaluation-report.json
normalized-actions.jsonl
raw-events.jsonl
run.json
worktree/
```

The deterministic evaluator report uses `completion_status: "COMPLETE"` when all four hard gates pass. Otherwise it uses `completion_status: "FAILED"` and identifies the failed gates.

## Sanitized example pair

In one prior controlled pair, both evaluator reports were `COMPLETE`. The baseline first edited `src/http/request.ts` at observable action 14. The changed harness first edited the same file at action 19. Both ran `npm test` before stopping.

The recorded action classes were:

| Action class | Baseline | Changed harness |
| --- | ---: | ---: |
| Read | 13 | 14 |
| Search | 2 | 4 |
| Edit | 2 | 1 |
| Execute | 2 | 1 |
| Test | 4 | 2 |

Both runs passed these deterministic evaluator gates:

```text
safe_get_retry: PASS
unsafe_post_no_duplicate: PASS
attempt_trace_per_physical_request: PASS
safe_http_500_no_retry: PASS
```

## What this example supports

The changed harness coincided with more observable repository inspection before the first edit and a different action sequence in this pair. Both final implementations passed the same evaluator.

The example does not establish that the changed harness caused the difference, that it is generally better, or that it is more correct, faster, or cheaper across tasks. Model sampling is not fully controlled. Use the fixed-control ledger and visible trace to describe this pair only.
