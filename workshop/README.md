# Hands-on workshop: build a harness ladder with Codex

In 45 minutes, you will run one fixed coding Taskset under five cumulative
harness policies. H0-H3 are pre-populated. You study the actual trajectories,
then add one mechanism in H4 and state a limited conclusion.

| Variant | Cumulative policy |
| --- | --- |
| H0 | Minimal fixed policy. |
| H1 | H0 plus task and API-contract reads before the first edit. |
| H2 | H1 plus a visible test before the first edit. |
| H3 | H2 plus full release checks after the final edit. |
| H4 | H3 plus one mechanism that you select. This is the only editable policy. |

This is a real controlled experiment, not a scripted score demo. A strong model
can pass H0. A later variant can improve, regress, or look unchanged. You compare
action order, scorer results, actions, and turns without claiming that one run
proves general superiority.

## Roles

- **You:** select the H4 mechanism and approve the final interpretation.
- **Codex:** operate the workshop, show safe evidence, recover, and write the card.
- **Pi inside Prime:** attempt the fixed task in a fresh disposable Runtime.
- **Facilitator:** explain the method and help with recovery; do not choose for you.

```text
orient -> preflight -> H0 -> H1 -> H2 -> H3
       -> HUMAN H4 DECISION -> H4 -> adjacent comparisons
       -> HUMAN CLAIM DECISION -> experiment card
       -> OPTIONAL trace analysis or another public Taskset
```

## Credentials and cost

The primary path is OpenAI-only.

- You need Codex access through a ChatGPT Plus or Pro subscription.
- You do not need a Prime Intellect account. Prime runs locally and upload is off.
- You do not need an OpenAI API key. Pi uses stored OpenAI Codex OAuth and
  subscription compute.
- If your subscription includes Codex, there is no separate API charge for this path.

Never print, paste, or share a token or key. Do not screen-share Pi's interactive
login because it can show local resource names. A shared organizer API key is
not part of this workshop.

## Setup before the session

Allow 10 to 15 minutes before the 45-minute workshop. Use macOS, Linux, or WSL 2
with Git, Node.js 22.19.0 or later, npm, `uvx`, Codex, and internet access.

```sh
git clone https://github.com/danialhasan/intro-to-harness-engineering-workshop.git
cd intro-to-harness-engineering-workshop/workshop/runner
node --version
uvx --version
npm ci
```

The workshop pins Prime Verifiers v1, `uv` 0.11.1, Pi 0.84.2, and
`openai-codex/gpt-5.5` with medium reasoning.

## Start the agent-native path

Open the cloned `workshop/` folder in Codex. Paste the prompt from
[WORKSHOP_AGENT.md](WORKSHOP_AGENT.md). Codex reads this guide, the local operator
contract, [TASK.md](candidates/retry-http/TASK.md), and the
[API contract](candidates/retry-http/docs/api-contract.md), then works from
`runner/`.

After it creates the experiment card, Codex reads
[prompts/README.md](prompts/README.md) and shows an optional continuation menu.
This keeps private trace analysis and follow-on Tasksets outside the controlled
H0-H4 ladder.

Codex runs:

```sh
npm run workshop:start
npm run workshop:doctor
npm run workshop:ladder
```

Doctor checks Node, types, the H4 boundary, pinned Prime, and safe OAuth. If it
reports `AUTH_REQUIRED`, take the keyboard in `runner/`:

```sh
npx --no-install pi
```

Enter `/login`, choose OpenAI Codex, complete the private browser sign-in, exit
Pi, and ask Codex to rerun doctor. Do not use a token-printing command.

## The fixed Taskset and evidence

The task implements retry-safe HTTP behavior:

- a safe catalog GET can retry 503 with bounded fake-clock backoff;
- a job-creating POST must not retry after a lost response;
- every physical request must create one attempt row;
- HTTP 500 must surface without retry.

Across all five variants, the Taskset, fixture, model, subscription-compute
route, reasoning, Prime Pi Harness, disposable Runtime, tools, limits, locks,
one rollout, and deterministic four-gate scorer stay fixed. The comparator
fails if any of the 24 controls differ.

After each run, Codex shows only a safe summary. The ladder table reports:

- whether the task and contract were read before the first edit;
- whether `npm test` ran before the first edit;
- whether `npm test`, `npm run check`, and `npm run eval` ran after the final edit;
- deterministic status and rewards;
- observable action count and agent turns.

Raw messages, tool results, command output, temporary paths, and credentials are
not in the report.

## Human decision 1: create H4

Review H0-H3. Choose one small mechanism tied to observed evidence. Valid
classifications include missing context, missing verification, unsafe action,
poor stopping, inefficient path, and no clear weakness.

Codex records your words, for example:

```sh
npm run workshop:record-decision -- \
  --classification "inefficient-path" \
  --evidence "The reference runs inspected files without first stating a short plan." \
  --mechanism "Require a three-step plan before repository inspection."
```

Codex then edits only the marked block in
[`runner/policies/h4.md`](runner/policies/h4.md). It must not bundle several
mechanisms. It validates and runs H4:

```sh
npm run check:h4
npm run workshop:h4
npm run workshop:compare
```

The comparison is valid only when H0→H1, H1→H2, H2→H3, and H3→H4 each report
policy `DIFFERENT` and all 24 controls `MATCH`.

## Human decision 2: interpret the ladder

Compare outcomes and trajectories. Approve one claim limited to these five
runs and one uncertainty. Codex finishes with your approved text:

```sh
npm run workshop:finish -- \
  --claim "In this ladder, the declared mechanisms changed the observed action order while every fixed control matched." \
  --uncertainty "One run per policy does not show whether these changes help other tasks or repeated runs."
```

Review the local `HARNESS_LADDER_EXPERIMENT_CARD.md`. It is the handoff artifact.
See [EXPECTED_OUTPUT.md](EXPECTED_OUTPUT.md) only as a fallback example; do not
call an example review a fresh experiment.

## Recovery and reset

Resume without repeating completed model calls:

```sh
npm run workshop:status
npm run workshop:ladder
```

`workshop:ladder` skips each stored completed H0-H3 run. `workshop:h4` also
recovers one completed but unclaimed H4 run.

To pause at a clean variant boundary, Codex can use:

```sh
npm run workshop:ladder -- --through h0
```

`--through` accepts `h0`, `h1`, `h2`, or `h3`. A later plain
`npm run workshop:ladder` resumes at the first missing variant.

Restore only H4 while preserving runs and reports:

```sh
npm run reset:h4
npm run check:h4
```

Reset writes a timestamped local backup. To start again after completion, use
`npm run workshop:start -- --new`. An incomplete ladder is never replaced
silently. Preserve failures; they are valid evidence. Do not change fixed
controls to force a pass.

## Privacy and accessibility

- Use only the synthetic public fixture. Never add client code or attendee data.
- `runner/runs/` contains local raw traces and must not be shared or committed.
- The OAuth adapter uses an operating-system-assigned localhost port and a
  random run key for each evaluation. The real credential stays in Pi's store.
- The subprocess Runtime uses a disposable workspace and HOME, but it is not an
  operating-system sandbox.
- Prime upload is disabled in every config.
- All instructions and outcomes are written text. No step depends on color,
  images, sound, hover, or slide order.

## Continue the pattern

Keep the completed card. If you do not know which failure deserves an
evaluation, use the [private trace failure-analysis
prompt](prompts/TRACE_FAILURE_ANALYSIS.md) in a separate task that owns your
trace data. It samples approved traces, clusters observed failures, preserves a
random discovery sample, and requires you to approve the taxonomy.

When you are ready for another public experiment, use the
[failure-mode Taskset library](tasksets/) and its privacy-safe chooser. The
library contains three prebuilt synthetic Tasksets. Do not substitute one
inside the completed `retry-http-v1` ladder.

For every new iteration, choose a deterministic Taskset, freeze controls, add
one cumulative mechanism, run fresh samples, and state only what the traces,
rewards, and metrics support.
