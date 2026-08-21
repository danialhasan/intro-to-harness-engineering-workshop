# Sanitized Prime workshop example

This is an example-review fallback. It is not a fresh participant experiment.

## Run summaries

```json
{
  "runId": "pair-example-baseline-11111111",
  "runDir": "<local-run-root>/pair-example/baseline/pair-example-baseline-11111111",
  "candidate": "baseline",
  "completionStatus": "COMPLETE",
  "primeExitCode": 0
}
```

```json
{
  "runId": "pair-example-changed-22222222",
  "runDir": "<local-run-root>/pair-example/changed/pair-example-changed-22222222",
  "candidate": "changed",
  "completionStatus": "COMPLETE",
  "primeExitCode": 0
}
```

Each native Prime trace recorded:

- model `openai-codex/gpt-5.5`;
- intercepted model calls linked to assistant nodes;
- tool calls and tool results;
- four rewards with score `1.0` and weight `0.25`;
- metric `evaluator_gates_passed = 4.0`;
- metric `evaluator_complete = 1.0`;
- stop condition `agent_completed`.

`npm run prime:inspect -- --run-dir "<runDir>"` prints the ordered tool calls,
rewards, metrics, and stop condition. It omits tool results, raw message
content, and absolute paths.

## Deterministic scorer

```text
PASS safe GET retries with bounded backoff
PASS unsafe POST does not duplicate a committed job
PASS trace records physical attempt outcomes
PASS safe HTTP 500 is surfaced without retry
RESULT PASS target=participant
```

## Controlled difference

Example participant mechanism statement:

```text
I changed this harness policy so the agent is asked to read TASK.md and the API
contract before its first edit.
```

In the example changed trace, the first turn requested `TASK.md`, `docs/api-contract.md`, and a file inventory before the first edit. The baseline used a different observable sequence. Both traces reached the same deterministic score.

## Comparator

```json
{
  "comparison": "pair-example",
  "valid": true,
  "fixedControls": 24,
  "baselineStatus": "COMPLETE",
  "changedStatus": "COMPLETE"
}
```

Every fixed-control row reported `MATCH`. The two policy hashes were `DIFFERENT`.

## Correct interpretation

```text
In this pair, the Taskset, model, subscription route, Runtime, tools, limits,
and deterministic scorer matched. We changed one required pre-edit read. The
Prime traces showed different observable tool sequences. Both scorers reported
COMPLETE. This one pair does not prove that either harness is generally better.
```

Do not interpret one pair as a general framework, model, prompt, or harness ranking.
