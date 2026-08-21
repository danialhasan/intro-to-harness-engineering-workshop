# Run this workshop with Codex

Use Codex as your workshop operator. Codex will run the mechanical steps and
keep the experiment resumable. You will make the two decisions that matter.

In this file, **you** means the attendee using this clone. The workshop
facilitator explains the exercise and helps with recovery, but is not the
participant and does not make your decisions.

## Start prompt

Open this `workshop/` directory in Codex, then send:

```text
Start the hands-on harness engineering workshop. Follow WORKSHOP_AGENT.md and
AGENTS.md. Act as my operator, explain evidence in plain language, and stop for
my decision at every HUMAN DECISION gate.
```

Codex should then:

1. Read this file, `README.md`, `candidates/retry-http/TASK.md`, and
   `candidates/retry-http/docs/api-contract.md`.
2. Work from `runner/` and run `npm run workshop:start`.
3. Run `npm run workshop:doctor`.
4. Stop for private OpenAI sign-in only if the safe check says it is required.
5. Run the baseline and show you its sanitized trace summary.
6. Present two or three mechanism options grounded in observable actions.
7. Wait for you to select the mechanism.
8. Record your decision, make the one bounded policy edit, and validate it.
9. Run the changed policy and fixed-control comparison.
10. Ask you to approve a limited claim and one remaining uncertainty.
11. Create `HARNESS_EXPERIMENT_CARD.md` and show it to you.

## What Codex must not decide

Codex can explain and challenge. It must not choose:

- which observed weakness matters;
- which policy mechanism to test;
- whether the changed trajectory is preferable;
- what the experiment proves.

Those choices are the participant's harness-engineering work.

Repository maintainers may run a labeled author simulation to validate the
workflow. An author simulation must not be presented as an attendee decision or
as proof that a fresh attendee completed the workshop.

## Resume prompt

If Codex or the terminal restarts, send:

```text
Resume the harness engineering workshop. Run npm run workshop:status from
runner/, preserve the current pair, and continue from the reported next step.
```

The local session file contains only a generated pair ID, workflow state, run
locations, and the participant's public-safe decision text. It is ignored by
Git.
