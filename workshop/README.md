# Hands-on workshop: change one harness rule

In 45 minutes, you will run the same coding task twice with one controlled difference: the harness configuration around a real Pi coding agent. You will inspect the recorded actions and a deterministic evaluator report. You will not build an agent loop or repair the task code yourself.

## What you will complete

```text
preflight -> baseline run -> inspect evidence -> edit changed H
          -> fresh changed run -> deterministic comparison -> limited claim
```

`H` means the harness configuration. A trajectory means the recorded sequence of observable actions, such as reads, searches, edits, and tests. The runner does not save hidden model reasoning.

Completion means that you produced two isolated run directories and a comparison with matching fixed controls. Either run may receive `COMPLETE`, `FAILED`, `TIMEOUT`, or a runner error. Those outcomes are evidence, not a reason to change the fixed task or evaluator.

## Prerequisites

Complete this section before the 45-minute workshop. Allow 10 to 15 minutes.

- macOS or Linux with a terminal. Windows participants should use WSL 2.
- Git.
- Node.js `22.19.0` or later and npm.
- Internet access for cloning, package installation, and the two model runs.
- A ChatGPT Plus or Pro subscription that includes Codex access.
- A code editor that can edit a TypeScript string array.

This path uses Pi OAuth with your ChatGPT subscription. It does not use OpenAI API billing and does not ask for an API key.

## 1. Clone and check the workshop

Run each command from left to right. Do not use a private work repository for this exercise.

```sh
git clone https://github.com/danialhasan/intro-to-harness-engineering-workshop.git
cd intro-to-harness-engineering-workshop/workshop/runner
node --version
npm ci
npm run check:types
npm run test:trace
npm run test:isolation
npm run test:compare
npm run smoke
npm run smoke:retry
```

`node --version` must report `v22.19.0` or later. The checks and smoke commands do not call a model. `npm run smoke:retry` passes only when the intentionally incomplete task produces a normal `FAILED` evaluator report.

Expected final lines include:

```text
trace fixture tests passed
resource isolation integration test passed
compare fixture test passed
run complete: ...
retry integration smoke passed: ...
```

The `...` text contains a generated local path or identifier.

## 2. Sign in to Pi with subscription compute

From `workshop/runner`, start the pinned Pi version:

```sh
npx --no-install pi
```

At the Pi prompt, enter:

```text
/login
```

Select `ChatGPT Plus/Pro (Codex)` and complete the browser sign-in. When Pi confirms the login, exit Pi. This stores Pi's normal local OAuth state for your account.

Do not copy, paste, print, send, or save a bearer token. Do not run a token-printing command. Do not create an API key for this workshop.

## Fixed experiment contract

The two runs keep these controls fixed:

- task: `retry-http/v1`;
- initial fixture: `workshop/candidates/retry-http`;
- model provider and model: `openai-codex/gpt-5.5`;
- thinking level: `medium`;
- Pi coding-agent runtime: pinned by `runner/package-lock.json`;
- tool list, seven-minute run timeout, resource isolation, and evaluator;
- fresh candidate worktree for every run.

Do not add provider, model, thinking, fixture, tool, evaluator, or timeout flags. The comparator fails closed if a declared fixed control is missing or different.

The fixed task is a retry-safe HTTP client:

- a safe catalog `GET` may retry a temporary `503`;
- a job-creating `POST` must not retry after its response is lost;
- every physical request must create one attempt-trace record.

Read [the fixed task](candidates/retry-http/TASK.md) and [API contract](candidates/retry-http/docs/api-contract.md). Do not edit them.

## Your only editable surface

Edit only the instruction strings between these two comments in [`runner/src/participant-harness.ts`](runner/src/participant-harness.ts):

```ts
// PARTICIPANT EDIT START
const participantChangedRules = [
  "...",
];
// PARTICIPANT EDIT END
```

Do not edit the baseline harness, gate logic, runner, task fixture, tests, evaluator, model controls, or package locks. Pi edits a fresh candidate copy of the task during each run. You do not edit the HTTP client.

Before you edit, write one mechanism statement in your notes:

```text
I changed this harness rule so the agent is asked to obtain or verify <evidence>
before <consequential action or stop>.
```

## 0 to 5 minutes: name your isolated pair

From `workshop/runner`, run:

```sh
export WORKSHOP_ROOT="$(cd .. && pwd)"
export RUN_ROOT="$WORKSHOP_ROOT/runner/runs"
export PAIR_ID="pair-$(date +%Y%m%d-%H%M%S)"
npm run check:types
```

`PAIR_ID` stays on your machine. Do not put a name, email address, employer, client, or other personal information in it.

## 5 to 15 minutes: run the baseline

Run this command exactly:

```sh
npm run run -- \
  --fixture "$WORKSHOP_ROOT/candidates/retry-http" \
  --task retry-http/v1 \
  --candidate baseline \
  --mode pi \
  --comparison "$PAIR_ID" \
  --run-root "$RUN_ROOT" \
  --timeout-ms 420000
```

The command prints JSON with `runId` and `runDir`. Copy both values exactly:

```sh
export BASELINE_RUN_ID="<baseline runId>"
export BASELINE_RUN="<baseline runDir>"
```

Inspect the evaluator and observable actions:

```sh
cat "$BASELINE_RUN/evaluation-report.json"
sed -n '1,160p' "$BASELINE_RUN/normalized-actions.jsonl"
```

The command may exit with status 1 when the deterministic evaluator reports `FAILED`. That is a valid baseline result. Continue if `evaluation-report.json` and `normalized-actions.jsonl` exist.

## 15 to 23 minutes: classify the first weak decision

Read the public task evidence and baseline trace:

```sh
cat "$WORKSHOP_ROOT/candidates/retry-http/TASK.md"
cat "$WORKSHOP_ROOT/candidates/retry-http/docs/api-contract.md"
sed -n '1,220p' "$BASELINE_RUN/raw-events.jsonl"
```

Name the first weak observable decision. Do not guess private model reasoning.

| Classification | Question |
| --- | --- |
| Missing context | What repository fact or contract condition should the agent have inspected? |
| Missing verification | What result should the agent have checked before it stopped? |
| Unsafe action | What action occurred without enough evidence? |
| Poor stopping | What declared requirement remained unresolved at stop time? |
| No clear weakness | What evidence shows that the path was reasonable? |

Do not force a failure. `No clear weakness` is valid when the evidence supports it.

## 23 to 31 minutes: change H

Open `runner/src/participant-harness.ts`. Change only the strings inside `participantChangedRules`. Make one small rule change that responds to your classification. Then run:

```sh
npm run check:types
```

Examples of small mechanisms are a required pre-edit inspection, a task-specific verification request, or an observable completion condition. Do not add a framework, model loop, provider, network service, or broad policy bundle.

## 31 to 41 minutes: run a fresh changed candidate

Use the same `PAIR_ID` and the exact fixed controls:

```sh
npm run run -- \
  --fixture "$WORKSHOP_ROOT/candidates/retry-http" \
  --task retry-http/v1 \
  --candidate changed \
  --mode pi \
  --comparison "$PAIR_ID" \
  --run-root "$RUN_ROOT" \
  --timeout-ms 420000
```

Copy the printed values, then inspect the result:

```sh
export CHANGED_RUN_ID="<changed runId>"
export CHANGED_RUN="<changed runDir>"
cat "$CHANGED_RUN/evaluation-report.json"
sed -n '1,160p' "$CHANGED_RUN/normalized-actions.jsonl"
```

## 41 to 45 minutes: compare and interpret

Generate the comparison with the two explicit run IDs:

```sh
npm run compare -- \
  --comparison "$PAIR_ID" \
  --baseline-run-id "$BASELINE_RUN_ID" \
  --changed-run-id "$CHANGED_RUN_ID" \
  --run-root "$RUN_ROOT"

cat "$RUN_ROOT/$PAIR_ID/fixed-control-ledger.json"
cat "$RUN_ROOT/$PAIR_ID/comparison-summary.md"
cat "$RUN_ROOT/$PAIR_ID/trace-alignment.json"
```

The comparison is valid only when every fixed-control row reports `MATCH`. Then answer:

1. What completion status did the evaluator record for each run?
2. What did the agent inspect before its first edit?
3. What verification action is visible before stop?
4. What observable action sequence changed?
5. Did the change address the weakness you classified?
6. What remains uncertain after one pair?

Use this result statement:

```text
In this pair, we held the declared task, fixture, model selection, Pi runner,
tool list, and evaluator fixed. We changed <H mechanism>. The recorded traces
differed in <observable actions>. The evaluator reported <result>. This one
pair does not prove that the changed harness is generally better.
```

See [expected output and interpretation](EXPECTED_OUTPUT.md) for a sanitized worked example.

## Reset and recovery

### Restore the starter harness

From `workshop/runner`, run:

```sh
npm run reset:harness
npm run check:types
```

The reset writes a timestamped local backup under `runner/backups/`, then restores only `runner/src/participant-harness.ts`.

### A run ID or pair already exists

Do not overwrite it. Set a new `PAIR_ID` and start a fresh pair:

```sh
export PAIR_ID="pair-$(date +%Y%m%d-%H%M%S)"
```

### A model run ends with `FAILED`, `TIMEOUT`, or a runner error

Inspect `run.json`, `evaluation-report.json`, and `normalized-actions.jsonl` in the printed run directory. If the files exist, keep the result as evidence. Do not change the fixed task, evaluator, model, or timeout to make it pass.

If authentication or the network prevents both model runs, pair with a preflight-ready participant. You can also complete the interpretation exercise with the [sanitized worked example](EXPECTED_OUTPUT.md). Mark that path as an example review, not a fresh model experiment.

### The comparison rejects the pair

Read `fixed-control-ledger.json`. A missing or different fixed control invalidates that pair. Restore the starter harness if needed, choose a new `PAIR_ID`, and run both candidates again without extra flags.

### Setup does not pass

Keep the exact error text. Check the Node version, rerun `npm ci`, and use the local Pi login again. Do not install a second agent framework or create an API key during the workshop.

## Privacy and authority boundary

Use only the included synthetic retry task. Do not place credentials, client code, personal data, private work, or external-service tasks in this repository.

Pi receives the fixed task and selected harness rules without inherited parent context files, skills, extensions, prompts, or themes. Its Bash authority is logged and limited by workshop instructions, but it is not an operating-system sandbox. Run the workshop in this disposable public clone.

The runner saves lifecycle events, tool calls, tool arguments, tool results, command output, and local paths. It does not save hidden model reasoning. Treat every generated run directory as private until you review it. Do not commit, upload, paste, or publish raw traces.

All instructions and decision states in this guide are written as text. No step depends on color, an image, audio, hover state, or slide order. Pair with another participant or use a screen reader and keyboard in your normal terminal and editor as needed.

## Continue after the workshop

Keep your changed harness and run pair in a private location. Review the traces before you share any derived result. Your next experiment is one more small rule change on the same synthetic task, followed by another fresh controlled pair.

Then apply the method to a safe repository that you own:

1. choose one fixed task and deterministic acceptance check;
2. identify one observable bottleneck;
3. change one harness mechanism;
4. run a fresh pair with the other controls fixed;
5. state only what the observed evidence supports.

Do not treat a successful workshop pair as a general ranking of prompts, models, agents, or harnesses.
