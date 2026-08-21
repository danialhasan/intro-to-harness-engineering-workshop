# Intro to Harness Engineering

Public materials for the 75-minute Intro to Harness Engineering lecture and workshop.

## View the lecture slides

Open the [live slide deck](https://danialhasan.github.io/intro-to-harness-engineering-workshop/slides/).

## Start the hands-on workshop

Go to the [complete participant workshop](workshop/README.md). OpenAI Codex self-drives a cumulative H0-H4 harness ladder while Prime and Pi run the fixed evaluation agent through subscription-based OAuth. H0-H3 are pre-populated; the attendee adds one mechanism in H4. The path includes two human decisions, adjacent fixed-control comparisons, resumable recovery, and a public-safe experiment card. No Prime Intellect account or OpenAI API key is required.

Codex discovers the participant flow through the repository and workshop
`AGENTS.md` files. After the experiment card, it must surface the
[workshop prompt map](workshop/prompts/README.md) without automatically starting
a follow-on task.

Allow 10 to 15 minutes before the event for setup. The controlled participant loop is designed for the 45-minute hands-on period.

## Explore the failure-mode Taskset library

The repository also includes a [privacy-safe library of prebuilt synthetic
Tasksets](workshop/tasksets/). The library maps aggregate registration-survey
failure themes to deterministic tasks about context grounding, dependency
integration, and verification before stopping. It does not contain the source
CSV, participant responses, quotations, contact information, or private
traces.

The tested live workshop continues to use `retry-http-v1`. Use the additional
Tasksets as optional follow-on experiments until their Prime adapters and
participant simulations are complete.

## Analyze failures in your own traces

After the workshop, use the
[private trace failure-analysis prompt](workshop/prompts/TRACE_FAILURE_ANALYSIS.md)
to sample and cluster traces from your own coding agents. The prompt keeps the
trace review separate from the controlled workshop pair, requires approval of
the exact local trace sources, and makes the participant the final authority
for the failure taxonomy. Private traces and derived review artifacts must not
be added to this public repository.

## Event shape

- 20 minutes: build a shared mental model of a coding-agent harness.
- 45 minutes: use Codex to run H0-H3, create H4, compare native trajectories and deterministic scores, and produce an experiment card.
- 10 minutes: interpret the observed trajectories, state the evidence limit, and close.

The separate [`lecture/`](lecture/) area documents the lecture release.

## Evidence and privacy boundary

A trajectory is the recorded sequence of observable agent actions. A comparison can show that a harness change coincided with a different recorded path in one controlled pair. It does not prove that one harness is generally better.

This repository does not include attendee information, private transcripts, credentials, private research notes, local machine paths, internal receipts, or raw saved telemetry.

## Status

The hands-on workshop is runnable from this public repository. The current lecture deck is published through GitHub Pages.
