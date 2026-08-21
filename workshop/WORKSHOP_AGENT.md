# Run the H0-H4 workshop with Codex

Open this `workshop/` directory in Codex and send:

```text
Start the hands-on H0-H4 harness engineering workshop. Follow AGENTS.md and
WORKSHOP_AGENT.md. Act as my operator. Run the pre-populated H0-H3 ladder,
explain the safe evidence in plain language, and stop for my H4 mechanism and
my final limited claim. Never read raw traces or expose credentials.
```

Codex must self-drive setup, preflight, H0-H3, safe inspection, recovery,
adjacent fixed-control comparisons, and the experiment card. You make two
decisions:

1. What one additional mechanism to add in H4.
2. What this one ladder supports and what remains uncertain.

Codex can suggest options based on observed actions. It cannot select or
silently rewrite either decision.

## Resume prompt

```text
Resume the H0-H4 workshop. From runner/, run npm run workshop:status, preserve
all completed variants, and continue from the reported next step. Do not repeat
a completed model call.
```

Repository maintainers must label their choices as author simulations. An
author simulation is not an attendee completion.
