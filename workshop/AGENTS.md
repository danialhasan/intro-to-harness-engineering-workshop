# Codex operator contract

This is a public, synthetic harness-engineering workshop. When an attendee asks
to start, act as the operator defined in `WORKSHOP_AGENT.md`.

The facilitator or repository author is not automatically the participant. A
maintenance run must label decisions with `--decision-source author-simulation`.

## Roles and fixed controls

- The attendee owns the H4 hypothesis, selected mechanism, and final claim.
- Codex owns setup, commands, safe summaries, recovery, and the experiment card.
- Pi inside Prime is the fixed evaluation agent. Do not replace it with Codex.
- Keep the model, Taskset, Runtime, scorer, tools, limits, locks, and compute
  route fixed across H0 through H4.

## Required operator path

1. Read `README.md`, `WORKSHOP_AGENT.md`, the fixed task, and its API contract.
2. Work from `runner/`. Start and run doctor.
3. Run the pre-populated H0-H3 ladder. It resumes without repeating a completed
   model call.
4. Show the reference table and safe summaries. Stop for the attendee to select
   one additional H4 mechanism.
5. Record the decision. Edit only text between the markers in
   `runner/policies/h4.md`. Run `npm run check:h4`.
6. Run H4 and compare every adjacent pair.
7. Stop for the attendee to approve a limited claim and uncertainty.
8. Finish and show `HARNESS_LADDER_EXPERIMENT_CARD.md`.
9. Read `prompts/README.md` and show its optional continuation menu once. Do
   not start a continuation until the attendee chooses it.

Do not edit H0-H3, configs, runner code, task fixture, tests, evaluator, package
locks, or documentation during an attendee run.

## Privacy and evidence

- Never ask for, print, copy, paste, or store a token or API key.
- Do not read or publish raw `traces.jsonl`. Use generated safe summaries.
- Do not put names, emails, URLs, private data, credentials, or absolute paths
  in decisions or experiment records.
- Prime upload must remain disabled.
- A trajectory difference, progression, regression, or unchanged score is valid
  evidence for this ladder only. It is not general proof that a harness is better.

If a command fails, preserve the evidence, run `npm run workshop:status`, and
follow the recovery section in `README.md`. Do not change controls to force a pass.

## Post-workshop discovery

After the experiment card, present the three choices in `prompts/README.md`:
analyze private traces, choose a prebuilt public Taskset, or stop. Every
continuation is optional. Do not select for the attendee.

If the attendee chooses private trace analysis, show
`prompts/TRACE_FAILURE_ANALYSIS.md`. Do not read or analyze private traces from
this public clone. That work belongs in a separate task and repository with
attendee-approved trace roots.

If the attendee chooses another public failure pattern, use
`tasksets/CHOOSE_A_TASKSET.md`, `tasksets/README.md`, and one prebuilt synthetic
Taskset. Do not substitute it inside the completed `retry-http-v1` ladder.
