# Run the H0-H4 workshop with Codex

Open this `workshop/` directory in Codex and send:

```text
Start the hands-on H0-H4 harness engineering workshop. Follow AGENTS.md and
WORKSHOP_AGENT.md. Act as my operator. Run the pre-populated H0-H3 ladder,
explain the safe evidence in plain language, and stop for my H4 mechanism and
my final limited claim. Never read raw traces or expose credentials.
After the experiment card, show me the optional continuation menu in
prompts/README.md.
```

Codex must self-drive setup, preflight, H0-H3, safe inspection, recovery,
adjacent fixed-control comparisons, and the experiment card. You make two
decisions:

1. What one additional mechanism to add in H4.
2. What this one ladder supports and what remains uncertain.

Codex can suggest options based on observed actions. It cannot select or
silently rewrite either decision.

## After the experiment card

Codex must show this menu once:

1. Analyze my private coding-agent traces and discover recurring failure modes.
2. Choose another public synthetic Taskset from a general failure pattern.
3. Stop here.

For private trace analysis, point to `prompts/TRACE_FAILURE_ANALYSIS.md` and
start a separate task in the repository that owns the traces. Do not read
private traces from this public clone.

For another Taskset, point to `tasksets/CHOOSE_A_TASKSET.md`. Do not ask for
private trace content and do not replace a variant in the completed ladder.

## Resume prompt

```text
Resume the H0-H4 workshop. From runner/, run npm run workshop:status, preserve
all completed variants, and continue from the reported next step. Do not repeat
a completed model call. If the experiment card exists, show the optional menu
in prompts/README.md.
```

Repository maintainers must label their choices as author simulations. An
author simulation is not an attendee completion.
