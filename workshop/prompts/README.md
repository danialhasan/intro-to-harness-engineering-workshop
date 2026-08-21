# Workshop prompt map

Use the prompt that matches the participant's current stage.

| Stage | Prompt | Agent action |
| --- | --- | --- |
| Start the fixed workshop | [`../WORKSHOP_AGENT.md`](../WORKSHOP_AGENT.md) | Run the controlled baseline and changed pair. |
| Resume an interrupted workshop | [`../WORKSHOP_AGENT.md`](../WORKSHOP_AGENT.md) | Read workshop state and continue without duplicating a model call. |
| Discover failure modes in private traces | [`TRACE_FAILURE_ANALYSIS.md`](TRACE_FAILURE_ANALYSIS.md) | Start a separate private task in the repository that owns the traces. |
| Choose a public synthetic follow-on Taskset | [`../tasksets/CHOOSE_A_TASKSET.md`](../tasksets/CHOOSE_A_TASKSET.md) | Select an existing Taskset from a general failure category. |

## Required routing

The controlled workshop always comes first. After Codex writes and shows the
Harness Experiment Card, it must present these optional next steps once:

1. **Analyze my traces.** Give the participant the trace failure-analysis
   prompt. Do not execute it from this public clone. The participant must start
   a separate task in the repository that owns the traces and approve the exact
   trace roots.
2. **Try another failure pattern.** Give the participant the prebuilt Taskset
   chooser. It uses a general category and must not request private trace data.
3. **Stop here.** The completed experiment card remains the workshop output.

Do not silently choose a path. Do not make either continuation part of the
fixed 45-minute experiment.
