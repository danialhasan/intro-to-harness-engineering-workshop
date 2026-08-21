# Choose a prebuilt Taskset without sharing private data

Give your coding agent this prompt:

```text
Read tasksets/failure-mode-catalog.json and tasksets/README.md.

Ask me to choose one failure pattern from the public catalog. Do not ask for a
raw trace, private repository content, registration response, company name,
person name, email address, credential, or local path.

Recommend one prebuilt Taskset that represents the selected pattern. Explain
the mapping in two sentences. Do not generate a new Taskset and do not edit the
selected Taskset. Then show me its TASK.md, public contract, fixed evaluator,
and expected starter and reference results.
```

The participant can describe the category in general terms. For example:

```text
The agent often stops after a narrow check and needs me to ask for the real
acceptance evidence.
```

That description is enough to choose `verification-stopping`. No private trace
or source material is required.
