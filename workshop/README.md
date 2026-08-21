# Hands-on workshop: conduct one harness experiment with Codex

In 45 minutes, you will use Codex as your operator to run one fixed coding task
twice through Prime Verifiers v1. You will inspect the baseline, choose one
bounded policy mechanism, and interpret a deterministic comparison.

The workshop has three clear roles:

| Role | Owner | Responsibility |
| --- | --- | --- |
| Participant | You | Choose the mechanism and approve the evidence-limited claim. |
| Operator agent | OpenAI Codex | Run commands, preserve state, summarize safe evidence, recover, and produce the experiment card. |
| Evaluation agent | Pi inside Prime | Attempt the fixed coding task under the baseline or changed policy. |

Codex does not replace the evaluation agent. Prime still records the evaluation
agent's native Taskset, Harness, Runtime, Trace, rewards, and metrics.

```text
orient -> preflight -> baseline -> HUMAN DECISION -> changed run
       -> compare -> HUMAN DECISION -> experiment card
```

## Credentials and cost

The primary path is OpenAI-only.

- You need access to Codex and a ChatGPT Plus or Pro subscription with Codex
  access.
- You do **not** need a Prime Intellect account. Prime upload is disabled, and
  the pinned open-source framework runs locally.
- You do **not** need an OpenAI API key. Pi uses a stored OpenAI Codex OAuth
  login and subscription compute.
- If your subscription already includes Codex, the workshop adds no separate
  API charge.

You may see two OpenAI sign-in surfaces: your normal Codex sign-in and Pi's
local `/login` for the evaluation agent. Both use OpenAI access. Neither step
requires you to copy a credential.

Do not print, copy, paste, send, or save a bearer token or API key. Do not
screen-share the interactive Pi login because it can show local resource names.

### Organizer-managed API fallback

The published experiment does not enable an API-key route. An OpenAI API key is
a separately billed secret, and one shared long-lived key is not a safe
attendee credential.

If an event must support attendees without an eligible subscription, the host
should prepare and test a separate event route in advance. Use a dedicated
OpenAI API project, limited event credentials, spend alerts, usage monitoring,
and immediate revocation after the event. Inject each secret outside the
repository and chat. Changing from OAuth subscription compute to API compute
creates a different fixed-control route, so both runs in a pair must use that
same route and it needs its own participant simulation.

## Complete setup before the workshop

Allow 10 to 15 minutes before the 45-minute session.

- macOS or Linux. Windows participants should use WSL 2.
- Git.
- Node.js `22.19.0` or later and npm.
- `uv`/`uvx`. Use the [official uv installation instructions](https://docs.astral.sh/uv/getting-started/installation/).
- OpenAI Codex, signed in with the account you will use during the workshop.
- Internet access for the clone, first package sync, and two model runs.

The workshop pins Prime Verifiers v1 to commit
`4bcb48e55a35c199d9d2f9722060fda627306aa3`, `uv` to `0.11.1`, Pi to `0.84.2`,
and the evaluation model to `openai-codex/gpt-5.5` with medium reasoning.

## 1. Clone and install

Use only this public synthetic repository. Do not open a private work
repository for this exercise.

```sh
git clone https://github.com/danialhasan/intro-to-harness-engineering-workshop.git
cd intro-to-harness-engineering-workshop/workshop/runner
node --version
uvx --version
npm ci
```

`node --version` must report `v22.19.0` or later.

## 2. Put Codex in the operator seat

Open the cloned `workshop/` directory in Codex. If you use the Codex CLI, run it
from that directory. Then paste the start prompt from [WORKSHOP_AGENT.md](WORKSHOP_AGENT.md).

Codex will read [AGENTS.md](AGENTS.md), create a generated pair ID, and run the
model-free checks. The first Prime sync can take several minutes.

The conductor stores progress in `runner/.workshop-session.json`. That file and
all run data are local and ignored by Git. If Codex restarts, use the resume
prompt in `WORKSHOP_AGENT.md`.

## 3. Private OpenAI sign-in, only when required

Codex runs this safe check as part of `npm run workshop:doctor`:

```sh
npx --no-install pi auth check --provider openai-codex --model gpt-5.5 --json
```

If it reports `ready` and `oauth`, continue. If it reports `AUTH_REQUIRED`, you
must take the keyboard. From `workshop/runner`, run:

```sh
npx --no-install pi
```

Enter `/login`, select `OpenAI Codex`, complete the browser sign-in, and exit
Pi. Tell Codex to rerun `npm run workshop:doctor`. Never use a token-printing
command.

## 4. Understand the fixed experiment

The included task implements this contract:

- a safe catalog `GET` can retry `503` with bounded fake-clock backoff;
- a job-creating `POST` must not retry after a lost response;
- every physical request must create one attempt trace.

Read [TASK.md](candidates/retry-http/TASK.md) and
[the API contract](candidates/retry-http/docs/api-contract.md). Do not edit them.

Both runs keep these controls fixed:

- Taskset and task: `retry-http-v1` and `retry-http/v1`.
- Initial public fixture: `candidates/retry-http`.
- Model and compute: `openai-codex/gpt-5.5` through stored Pi OAuth subscription access.
- Reasoning: medium.
- Harness: the pinned Prime Pi harness adapter.
- Runtime: one fresh disposable subprocess workspace.
- Tools, 24-turn limit, seven-minute timeout, locks, evaluator, one task, and one rollout.
- Prime upload: disabled.

The comparator fails closed if any fixed control is absent or different.

## 5. Run the baseline

Codex runs:

```sh
npm run workshop:baseline
```

The conductor discovers and stores the run ID. It creates a sanitized summary
that lists ordered tool calls, rewards, metrics, and the stop condition. It
omits raw messages, tool results, credentials, and absolute paths.

The evaluation can finish as `COMPLETE`, `FAILED`, or an error. Keep the real
result. Do not change the fixed task or scorer to force a pass.

## 6. Make the first human decision

Codex must stop after the baseline. It will present two or three options tied to
observable evidence. Use these classifications:

| Classification | Question |
| --- | --- |
| Missing context | What public repository fact should the evaluation agent have read? |
| Missing verification | What result should it have checked before stop? |
| Unsafe action | What action occurred without enough evidence? |
| Poor stopping | What requirement remained unresolved at stop? |
| No clear weakness | What trace evidence shows a reasonable path? |

`No clear weakness` is valid. Select one mechanism or write your own. Codex
records your decision before it can continue.

Your mechanism should fit this statement:

```text
I changed this harness policy so the evaluation agent is asked to obtain or
verify <evidence> before <consequential action or stop>.
```

The conductor command is explicit and recoverable:

```sh
npm run workshop:record-decision -- \
  --classification "missing-context" \
  --evidence "The baseline did not read the public task contract before its first edit." \
  --mechanism "Require the public task and API contract before the first edit."
```

Codex must replace this example with your selected classification and wording.
Do not put names, email addresses, links, credentials, private data, or local
paths in these fields.

## 7. Change one bounded harness policy

After you choose, Codex edits only the text between the two marker comments in
[`runner/policies/participant.md`](runner/policies/participant.md):

```md
<!-- PARTICIPANT EDIT START -->
Change only this instruction text.
<!-- PARTICIPANT EDIT END -->
```

It must run `npm run check:policy`. Do not add a new provider, agent loop,
framework, task, scorer, or broad policy bundle.

## 8. Run and compare

Codex runs:

```sh
npm run workshop:changed
npm run workshop:compare
```

The conductor rejects an unchanged or out-of-bounds policy. It uses the stored
run IDs, so you do not copy paths or environment variables. The pair is valid
only when the policy is `DIFFERENT`, `valid` is `true`, and every fixed-control
row is `MATCH`.

## 9. Make the second human decision

Codex must stop again. Review:

1. scorer status and reward for each trace;
2. what each evaluation agent inspected before its first edit;
3. what verification appeared before stop;
4. which observable tool sequence changed;
5. whether the change addressed your classification;
6. what remains uncertain after one pair.

Approve a claim that follows this boundary:

```text
In this pair, the fixed controls matched. We changed <policy mechanism>. The
Prime traces differed in <observable actions>. The scorer reported <results>.
This one pair does not prove that either harness is generally better.
```

Codex then creates a local, public-safe `HARNESS_EXPERIMENT_CARD.md` containing
the decision, fixed-control result, sanitized trajectories, limited claim, and
remaining uncertainty. Review it before sharing it.

The final conductor command is:

```sh
npm run workshop:finish -- \
  --claim "In this pair, the selected policy mechanism changed the observable trajectory while all fixed controls matched." \
  --uncertainty "One pair does not show whether the mechanism helps other tasks or runs."
```

Codex must replace the example with the claim and uncertainty that you approve.

See [EXPECTED_OUTPUT.md](EXPECTED_OUTPUT.md) if you cannot complete two live
model runs. State that you reviewed an example; do not call it a fresh
experiment.

## Recovery

### Resume after an interruption

From `workshop/runner`, run:

```sh
npm run workshop:status
```

The command reports the current stage and exact next action. It does not rerun
a completed model call.

### Restore the starter policy

```sh
npm run reset:policy
npm run check:policy
```

Reset creates a timestamped local backup and restores only the participant
policy. It does not delete runs or the experiment card.

### Start another experiment

After a completed experiment:

```sh
npm run workshop:start -- --new
```

An incomplete session is never replaced silently. Use `--discard-incomplete`
only after the participant approves discarding that session.

### A command or model run fails

Preserve the output and run `npm run workshop:status`. Do not change the model,
Taskset, scorer, timeout, package pins, or controls. A scorer result of `FAILED`
is valid evidence. If authentication expired, repeat the private `/login`
handoff and resume.

### The comparison is invalid

Read `runs/<pair>/fixed-control-ledger.json`. Preserve the pair. Start a new
experiment and run both candidates without extra flags.

## Privacy, authority, and accessibility

- Use only the included synthetic task. Do not add attendee data, client code,
  credentials, private work, or personal identifiers.
- The OAuth adapter listens only on `127.0.0.1`, uses a random per-run key, and
  leaves the real OAuth credential inside Pi's credential store.
- Each Prime run uses a temporary workspace and disposable `HOME`. It does not
  inherit parent agent instructions or stored credentials.
- The subprocess Runtime is not an operating-system sandbox. Use only this
  disposable public clone.
- Raw Prime traces can contain prompts, tool arguments, tool results, command
  output, and temporary paths. Treat `runner/runs/` as private local data. Use
  only the generated safe summaries for discussion.
- Prime upload is disabled in both configs.
- Every instruction and result is available as text. No step depends on color,
  images, audio, hover state, or slide order.

## Continue after the workshop

Use the completed experiment card as the input to a second, safer iteration:

1. Choose one public Taskset with a deterministic reward.
2. Keep the Harness, model, Runtime, and scorer fixed.
3. Identify one observable trajectory bottleneck.
4. Let the human choose one policy or harness mechanism.
5. Run a fresh pair and compare fixed controls.
6. State only what the traces, rewards, and metrics support.

Do not turn one successful pair into a general ranking of agents, models,
prompts, or harnesses.
