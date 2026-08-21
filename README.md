# Intro to Harness Engineering

Public materials for the 75-minute Intro to Harness Engineering lecture and workshop.

## View the lecture slides

Open the [live slide deck](https://danialhasan.github.io/intro-to-harness-engineering-workshop/slides/).

## Start the hands-on workshop

Go to the [complete participant workshop](workshop/README.md). It uses the Prime Verifiers v1 Taskset, Harness, Runtime, Trace, reward, and metric contracts with subscription-based Pi OAuth. The guide contains the fixed task, one bounded policy edit, expected results, recovery steps, privacy rules, and continuation path.

Allow 10 to 15 minutes before the event for setup. The controlled participant loop is designed for the 45-minute hands-on period.

## Event shape

- 20 minutes: build a shared mental model of a coding-agent harness.
- 45 minutes: run a Prime baseline, change one harness policy, run again, and compare native traces and deterministic scores.
- 10 minutes: interpret the observed trajectories, state the evidence limit, and close.

The separate [`lecture/`](lecture/) area documents the lecture release.

## Evidence and privacy boundary

A trajectory is the recorded sequence of observable agent actions. A comparison can show that a harness change coincided with a different recorded path in one controlled pair. It does not prove that one harness is generally better.

This repository does not include attendee information, private transcripts, credentials, private research notes, local machine paths, internal receipts, or raw saved telemetry.

## Status

The hands-on workshop is runnable from this public repository. The current lecture deck is published through GitHub Pages.
