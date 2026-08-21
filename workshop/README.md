# Hands-on workshop: change one harness policy

In 45 minutes, you will run one fixed coding task twice through Prime Verifiers v1. You will change one bounded harness policy, compare the two Prime traces, and interpret a deterministic score.

You will use these standard parts:

```text
Taskset -> Harness -> Runtime -> Trace -> rewards and metrics
```

- **Taskset:** one public retry-safe HTTP task and its deterministic scorer.
- **Harness:** Prime's Pi coding-agent harness plus the selected policy.
- **Runtime:** a fresh disposable local workspace for each run.
- **Trace:** Prime's record of model calls, messages, tool calls, timing, rewards, and metrics.
- **Rewards and metrics:** four fixed evaluator gates, each worth `0.25`, plus gate-count and completion metrics.

The runner sets Prime `push = false`. Nothing is uploaded to Prime. A localhost-only adapter uses Pi's stored OpenAI Codex OAuth login. It does not print or save the credential and does not use OpenAI API billing.

## What you will complete

```text
preflight -> baseline -> inspect -> edit one policy -> changed run -> compare -> limited claim
```

Completion means that you have two fresh Prime run directories and a comparison whose fixed-control rows all say `MATCH`. A run can finish as `COMPLETE`, `FAILED`, or an error. Keep the observed result. Do not change the fixed task or scorer to force a pass.

## Prerequisites

Complete this section before the 45-minute workshop. Allow 10 to 15 minutes.

- macOS or Linux with a terminal. Windows participants should use WSL 2.
- Git.
- Node.js `22.19.0` or later and npm.
- `uv`/`uvx`. Install it from the [official uv instructions](https://docs.astral.sh/uv/getting-started/installation/) if `uvx --version` fails.
- Internet access for the clone, first package sync, and two model runs.
- A ChatGPT Plus or Pro subscription with Codex access.
- A text editor.

The workshop pins:

- Prime Verifiers v1 to official commit `4bcb48e55a35c199d9d2f9722060fda627306aa3`;
- `uv` to `0.11.1` for Prime's runtime scripts;
- Pi to `0.84.2`;
- model to `openai-codex/gpt-5.5` with medium reasoning.

## 1. Clone and run the model-free preflight

Use only this public synthetic repository. Do not use a private work repository.

```sh
git clone https://github.com/danialhasan/intro-to-harness-engineering-workshop.git
cd intro-to-harness-engineering-workshop/workshop/runner
node --version
uvx --version
npm ci
npm run check:types
npm run check:policy
npm run prime:sync
uvx --from uv==0.11.1 uv run --project prime eval @ configs/baseline.toml --dry-run
```

`node --version` must report `v22.19.0` or later. The first Prime sync downloads Python and the pinned framework, so it can take several minutes. The last command must report that it wrote a resolved config. These commands do not call a model.

Prime prints a general warning because this workshop uses its subprocess runtime. The task still runs in a new temporary directory with a disposable `HOME`; this blocks inherited project instructions and user-level Pi resources. It is not an operating-system sandbox, so use only the included public task.

## 2. Sign in to Pi with subscription compute

From `workshop/runner`, check the stored route without printing a token:

```sh
npx --no-install pi auth check --provider openai-codex --model gpt-5.5 --json
```

If the response says `"status":"ready"` and `"authType":"oauth"`, continue.

Otherwise, start Pi:

```sh
npx --no-install pi
```

Enter `/login`, select `OpenAI Codex`, and complete the browser sign-in. Exit Pi, then run the safe auth check again.

Do not print, copy, paste, send, or save a bearer token. Do not create an API key. The interactive login screen can show local resource names, so do not screen-share the login step.

## Fixed experiment contract

Both runs keep these controls fixed:

- Taskset and task: `retry-http-v1` and `retry-http/v1`.
- Initial public fixture: `workshop/candidates/retry-http`.
- Model and compute: `openai-codex/gpt-5.5` through stored Pi OAuth subscription access.
- Reasoning: medium.
- Harness: the pinned Prime Pi harness adapter.
- Runtime: one fresh disposable subprocess workspace.
- Tools, 24-turn limit, seven-minute rollout timeout, package locks, evaluator, one task, and one rollout.
- Prime upload: disabled.

The comparator fails closed if a fixed control is absent or different.

The task implements this contract:

- a safe catalog `GET` can retry `503` with bounded fake-clock backoff;
- a job-creating `POST` must not retry after a lost response;
- every physical request must create one attempt trace.

Read [TASK.md](candidates/retry-http/TASK.md) and [the API contract](candidates/retry-http/docs/api-contract.md). Do not edit them.

## Your only editable surface

Edit only the text between the two marker comments in [policies/participant.md](runner/policies/participant.md):

```md
<!-- PARTICIPANT EDIT START -->
Change only this instruction text.
<!-- PARTICIPANT EDIT END -->
```

Do not edit the baseline policy, Prime configs, Taskset, harness code, OAuth adapter, task fixture, scorer, model controls, or lock files.

Before you edit, write this mechanism statement in your notes:

```text
I changed this harness policy so the agent is asked to obtain or verify <evidence>
before <consequential action or stop>.
```

## 0 to 5 minutes: name the pair

Use a local ID with no personal or client information:

```sh
export PAIR_ID="pair-$(date +%Y%m%d-%H%M%S)"
```

## 5 to 15 minutes: run the baseline

```sh
npm run prime:baseline -- --comparison "$PAIR_ID"
```

The command prints `runId`, `runDir`, `completionStatus`, and `primeExitCode`. Copy the exact first two values:

```sh
export BASELINE_RUN_ID="<baseline runId>"
export BASELINE_RUN="<baseline runDir>"
cat "$BASELINE_RUN/evaluation-report.json"
rg '"name"|"finish_reason"|"completion_status"' "$BASELINE_RUN/traces.jsonl"
```

`traces.jsonl` is the native Prime trace. `evaluation-report.json` is a convenient copy of its deterministic scorer result.

## 15 to 23 minutes: classify one observable weakness

Use the task, API contract, and trace. Do not guess hidden model reasoning.

| Classification | Question |
| --- | --- |
| Missing context | What public repository fact should the agent have read? |
| Missing verification | What result should the agent have checked before stop? |
| Unsafe action | What action occurred without enough evidence? |
| Poor stopping | What requirement was unresolved when the agent stopped? |
| No clear weakness | What trace evidence shows a reasonable path? |

`No clear weakness` is valid. One run does not need to fail for this exercise to work.

## 23 to 31 minutes: change one policy instruction

Edit only the marked section of `policies/participant.md`. Make one small change that responds to your classification. Then run:

```sh
npm run check:policy
```

Examples include one required pre-edit read, one task-specific verification, or one observable stop condition. Do not add a second framework, a new agent loop, a provider, a network service, or a broad policy bundle.

## 31 to 41 minutes: run the changed policy

```sh
npm run prime:changed -- --comparison "$PAIR_ID"
```

The command rejects an unchanged policy or an edit outside the marked boundary. Copy the exact output values:

```sh
export CHANGED_RUN_ID="<changed runId>"
export CHANGED_RUN="<changed runDir>"
cat "$CHANGED_RUN/evaluation-report.json"
rg '"name"|"finish_reason"|"completion_status"' "$CHANGED_RUN/traces.jsonl"
```

## 41 to 45 minutes: compare and interpret

Use the two explicit run IDs:

```sh
npm run prime:compare -- \
  --comparison "$PAIR_ID" \
  --baseline-run-id "$BASELINE_RUN_ID" \
  --changed-run-id "$CHANGED_RUN_ID"

cat "runs/$PAIR_ID/fixed-control-ledger.json"
cat "runs/$PAIR_ID/comparison-summary.md"
```

The pair is valid only when `valid` is `true`, the policy difference is `DIFFERENT`, and every fixed-control row is `MATCH`.

Answer these questions:

1. What scorer status and reward did each trace record?
2. What did each agent inspect before its first edit?
3. What verification action appears before stop?
4. What observable tool sequence changed?
5. Did the change address your classification?
6. What remains uncertain after one pair?

Use this evidence statement:

```text
In this pair, the Taskset, model, subscription route, Runtime, tools, limits,
and deterministic scorer matched. We changed <policy mechanism>. The Prime
traces differed in <observable actions>. The scorer reported <results>. This
one pair does not prove that either harness is generally better.
```

See [the sanitized expected output](EXPECTED_OUTPUT.md) for an example.

## Reset and recovery

### Restore the starter policy

```sh
npm run reset:policy
npm run check:policy
```

Reset creates a timestamped local backup in `runner/backups/`, then restores only `policies/participant.md`.

### A run directory already exists

The runner never overwrites a run. Create a new pair ID and rerun both candidates.

### Auth is not ready

Repeat the `/login` step, then use the safe JSON auth check. Never use a token-printing command.

### Prime fails before scoring

Read `prime-eval.log` and `traces.jsonl` in the printed run directory. Keep the exact error. Do not change the model, task, scorer, timeout, or package pins to hide it.

### A scorer reports `FAILED`

Keep the trace as evidence and continue. A failed task result is valid workshop data.

### The changed run rejects the policy

Run `npm run check:policy`. If text outside the markers changed, run `npm run reset:policy` and make the bounded edit again.

### The comparison rejects the pair

Read `fixed-control-ledger.json`. Use a new pair ID and run both candidates again without extra flags.

### You cannot complete two model runs

Pair with a preflight-ready participant or use [EXPECTED_OUTPUT.md](EXPECTED_OUTPUT.md). State that you reviewed an example; do not call it a fresh experiment.

## Privacy, authority, and accessibility

- Use only the included synthetic task. Do not add client code, attendee data, credentials, private work, or personal identifiers.
- The OAuth adapter listens only on `127.0.0.1`, requires a random per-run key, and keeps the real OAuth credential inside Pi's credential store.
- Each Prime runtime uses a temporary directory and disposable `HOME`. It does not inherit parent `AGENTS.md` files, Pi skills, prompts, extensions, themes, or stored credentials.
- The subprocess runtime is not an operating-system sandbox. The written policy forbids network use, but Bash can still start network commands. Use this disposable public clone only.
- Prime traces can contain prompts, tool arguments, tool results, command output, and local temporary paths. They do not contain hidden model reasoning. Treat `runner/runs/` as private local data. Review it before sharing any derived claim. Do not commit or publish raw traces.
- Prime upload is disabled in both configs.
- Every instruction and result state is available as text. No step depends on color, images, audio, hover state, or slide order.

## Continue after the workshop

Use the same Prime vocabulary and loop:

1. Choose one safe Taskset with a deterministic reward.
2. Keep the Harness, model, Runtime, and scorer fixed.
3. Identify one observable trace bottleneck.
4. Change one policy or harness mechanism.
5. Run a fresh pair and compare fixed controls.
6. State only what the traces, rewards, and metrics support.

Do not treat one successful pair as a general ranking of agents, models, prompts, or harnesses.
