# Sanitized agent-native workshop example

This is an example-review fallback. It is not a fresh participant experiment.

## Conductor stages

```text
Workshop pair: pair-example
Stage: baseline_complete
Baseline: COMPLETE
Next: Review the safe baseline summary. Ask the participant to choose one
evidence-linked mechanism, then record it.
```

After the participant decision and changed run:

```text
{
  "comparison": "pair-example",
  "valid": true,
  "fixedControls": 24,
  "baselineStatus": "COMPLETE",
  "changedStatus": "COMPLETE"
}
```

Every fixed-control row reports `MATCH`, and the policy difference reports
`DIFFERENT`.

## Sanitized trace summaries

Each summary contains:

- task ID;
- evaluator completion state;
- stop condition;
- rewards and metrics;
- an ordered list of observable tool calls with safe repository paths or
  command categories.

It omits raw messages, tool results, command output, credentials, and absolute
paths.

## Deterministic scorer

```text
PASS safe GET retries with bounded backoff
PASS unsafe POST does not duplicate a committed job
PASS trace records physical attempt outcomes
PASS safe HTTP 500 is surfaced without retry
RESULT PASS target=participant
```

## Participant decision

Example classification: `missing-context`.

Example mechanism:

```text
Require the evaluation agent to read TASK.md and docs/api-contract.md before
its first implementation edit.
```

The participant, not Codex, selects this mechanism after reading the sanitized
baseline evidence.

## Example experiment-card interpretation

```text
In this pair, all fixed controls matched. We added one required pre-edit read.
The Prime traces showed different observable tool sequences. Both scorers
reported COMPLETE. The experiment does not establish whether this mechanism
helps other tasks, models, or runs.
```

The final `HARNESS_EXPERIMENT_CARD.md` also includes the participant's remaining
uncertainty and the fixed evidence boundary. It does not include raw traces or
private local paths.
