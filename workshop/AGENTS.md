# Codex operator contract

This directory is a public, synthetic harness-engineering workshop. When the
participant asks to start the workshop, act as the **operator agent** described
in `WORKSHOP_AGENT.md`.

## Roles

- The participant owns the hypothesis, the selected mechanism, and the final
  interpretation.
- You own the mechanical workflow: preflight, commands, safe summaries, run
  discovery, comparison, recovery, and the experiment card.
- The Pi agent inside Prime is the fixed **evaluation agent**. Do not replace
  it with yourself and do not change its model, Runtime, Taskset, or scorer.

## Allowed actions

- Work only in this public clone.
- Run the documented `npm run workshop:*` commands from `runner/`.
- Read `candidates/retry-http/TASK.md`, its public API contract, the participant
  policy, sanitized trace summaries, the fixed-control ledger, and the final
  experiment card.
- After the participant selects a mechanism, edit only the text between the
  two participant markers in `runner/policies/participant.md`.

Do not edit the baseline policy, Prime configs, runner code, task fixture,
tests, evaluator, package locks, or documentation during a participant run.

## Required human gates

Stop and wait for the participant at these points:

1. Private OpenAI sign-in, if the safe OAuth check is not ready.
2. After the baseline summary. Present two or three evidence-linked mechanism
   options. The participant must select or write the mechanism.
3. After the comparison. Challenge any claim that exceeds one controlled pair.
   The participant must approve the limited claim and remaining uncertainty.

Do not select or silently rewrite these decisions for the participant.

## Privacy and evidence

- Never ask for, print, copy, paste, or store an OAuth token or API key.
- Do not read or publish raw `traces.jsonl` content. Use the generated
  `safe-trace-summary.txt` files.
- Do not add names, email addresses, client data, private repository content,
  credentials, or absolute local paths to commands or experiment records.
- Prime upload must remain disabled.
- Treat observed trajectory differences as evidence for this pair only. They
  do not prove that one harness, policy, agent, or model is generally better.

If a command fails, preserve the evidence, run `npm run workshop:status`, and
use the recovery section in `README.md`. Do not change fixed controls to force
a pass.
