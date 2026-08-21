# Prebuilt synthetic Taskset library

This library turns recurring workshop-registration failure themes into small,
public, deterministic coding tasks. It does not contain the registration CSV,
participant responses, quotations, names, employers, contact information, or
private traces.

The primary 45-minute workshop still uses the independently tested
`retry-http-v1` Taskset. These additional Tasksets are optional follow-on
experiments until each one has a Prime adapter and a public participant
simulation.

## Choose by failure pattern

| Failure pattern | Prebuilt Taskset | What the synthetic task tests |
| --- | --- | --- |
| The agent acted before reading the governing contract. | [`context-contract`](context-contract/) | Whether the implementation follows a public import contract rather than plausible defaults. |
| The agent made a local change without respecting connected dependencies. | [`dependency-integration`](dependency-integration/) | Whether a release order respects enabled services, dependency order, and cycles. |
| The agent stopped before checking the evidence required for completion. | [`verification-stopping`](verification-stopping/) | Whether a release marker is blocked until required checks and artifact identity are verified. |

Use [CHOOSE_A_TASKSET.md](CHOOSE_A_TASKSET.md) with a coding agent. The chooser
uses only a participant-selected failure category. It must not request private
source, raw traces, registration answers, or identifying information.

If the participant does not yet have an evidence-backed failure category, run
the [trace failure-analysis prompt](../prompts/TRACE_FAILURE_ANALYSIS.md) as a
separate private task in the repository that owns the traces. Bring only the
approved category back to this chooser.

## Common contract

Every Taskset contains:

- a synthetic `TASK.md`;
- a public contract under `docs/`;
- deliberately incomplete starter code under `src/` and `starter/`;
- participant-visible tests;
- a fixed deterministic evaluator;
- a known-good reference implementation; and
- a reset command.

For each Taskset, the expected validation state is:

```text
npm run check          -> PASS
npm test               -> FAIL on the starter
npm run eval           -> FAIL on the starter
npm run eval:reference -> PASS
```

Do not edit `docs/`, `test/`, `verifier/`, or `reference/` during an experiment.
Once a pair begins, keep the selected Taskset, fixture, model, runtime, tools,
limits, and evaluator fixed.

## Evidence source and privacy

The source survey question was:

> Tell us about one task you tried to give a coding agent where it struggled,
> failed, or needed too much supervision.

Twenty-four of 47 registration records answered the optional question. The
responses were manually coded with overlapping themes. The public aggregate is
stored in [failure-mode-catalog.json](failure-mode-catalog.json). Counts are
mentions, not mutually exclusive people, and the coding has not been tested for
inter-rater agreement.
