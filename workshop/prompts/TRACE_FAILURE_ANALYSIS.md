# Find failure modes in your coding-agent traces

Use this prompt after the controlled workshop experiment. It turns a private
collection of coding-agent traces into a local, evidence-linked failure
taxonomy. It does not change the completed workshop pair or its evaluator.

The method adapts Hamel Husain and Shreya Shankar's guidance on
[error analysis and trace sampling](https://hamel.dev/blog/posts/evals-faq/):
start with observed traces, keep random examples in every review batch, write
open-ended failure notes, cluster those notes into a taxonomy, and let a human
domain expert approve the categories.

## Copy this prompt into your coding agent

```text
Act as my local trace-review operator. Build an evidence-linked failure
taxonomy from my coding-agent traces. Do not modify my agents, harnesses,
traces, repositories, or evaluators during this analysis.

BOUNDARIES

- Work from local files only. Do not upload traces, call external services,
  use remote embeddings, or publish any output.
- Before you read trace content, ask me to approve the exact trace directories,
  time window, and whether sanitized trace content may be processed by the
  current model provider. Do not search my whole home directory.
- Treat traces as sensitive. Never print raw prompts, tool results, source
  code, credentials, tokens, cookies, email addresses, private URLs, absolute
  paths, or personal data into chat or durable output.
- Never delete or rewrite a source trace. Store derived work under
  `.trace-review/` and ensure that directory is ignored by Git.
- Use opaque trace IDs. Use short paraphrases and event references as evidence,
  not raw quotations.
- If you cannot make a safe sanitized working set, stop and explain the risk.
- Do not infer hidden reasoning or chain-of-thought. Analyze only recorded
  actions, messages, tool calls, feedback, state changes, and outcomes.

PHASE 1 — INVENTORY AND SANITIZE

1. Ask for my approval of the trace roots, date range, and review limit.
2. Make a read-only inventory. Report only counts, formats, date coverage, and
   parsing failures before reading content.
3. Create a sanitized derived record for each trace. Keep only:
   - opaque trace ID and coarse date bucket;
   - agent or harness family, when safe;
   - duration, step count, tool-call count, retry count, and error count;
   - human correction or intervention count;
   - termination and evaluator status, when present;
   - a short paraphrase of the task type;
   - observable event references that can support later review.
4. Record how many traces were excluded and why. Do not silently skip data.

PHASE 2 — SAMPLE FOR DISCOVERY

Cluster all sanitized trace summaries, but use human review to validate the
clusters. If the collection has 30 or fewer usable traces, review all of them.
Otherwise create a first review batch of 30:

- 40% seeded random traces;
- 30% stratified across agent family, task type, and time period; and
- 30% outliers, such as long runs, repeated retries, tool errors, human
  corrections, or incomplete termination.

Also select at least one representative from every discovered cluster. Keep
the random seed and selection reason for each trace. Keep a random component in
every later batch so known signals do not hide new failures.

PHASE 3 — OPEN CODE THE REVIEWED TRACES

For each reviewed trace, record:

- `pass`, `failure`, or `unclear`;
- the first observable failure, because upstream failures can cause later ones;
- any additional independent failure;
- the event IDs that support the judgment;
- the effect on the task outcome;
- whether a human correction was required;
- severity and confidence; and
- one short open-ended note in plain language.

Do not begin with a fixed list of failure modes. Let the recorded behavior
produce the initial labels.

PHASE 4 — BUILD THE FAILURE TAXONOMY

Cluster the open-ended notes into distinct failure modes. Name every category
with an observable behavior, not a vague quality. For example, prefer
`stopped after a narrow check` to `poor reasoning`.

For every proposed category, report:

- definition and exclusion rule;
- reviewed-trace count and denominator;
- high-impact count;
- representative opaque trace IDs and evidence event IDs;
- common human corrections;
- confidence and unresolved ambiguity; and
- the likely harness surface only after the category exists: intelligence,
  information, capabilities, control, or trust.

Do not claim that sample frequency is full-corpus frequency. If you classify
the remaining sanitized summaries with the proposed taxonomy, label those
counts as model-assisted estimates and keep an audit sample for human review.

PHASE 5 — HUMAN REVIEW GATE

Show me:

1. the proposed taxonomy;
2. the three most common failure modes;
3. the three highest-impact failure modes;
4. at least three borderline or unclear cases; and
5. categories that might need to merge, split, or be renamed.

Wait for me to approve or revise the taxonomy. I am the final labeling
authority. Do not write eval recommendations before this gate.

PHASE 6 — TURN OBSERVATIONS INTO NEXT STEPS

After I approve the taxonomy:

1. Rank failure modes by observed frequency, impact, and cost to detect.
2. Recommend a binary evaluator only when the failure has a clear observable
   contract. Do not automate an evaluator for every category.
3. Identify simple bugs or contract gaps that should be fixed directly.
4. Map relevant categories to the workshop's prebuilt Tasksets, without forcing
   a match:
   - `context-contract/v1`
   - `dependency-integration/v1`
   - `verification-stopping/v1`
5. State which failures need more traces or human judgment before action.
6. Do not use this retrospective analysis to redefine the evaluator for an
   experiment that has already run. Use it to design a new Taskset, evaluator,
   or controlled pair.

OUTPUTS

Write these private local artifacts under `.trace-review/`:

- `README.md` — scope, approved sources, method, privacy limits, and evidence
  limits;
- `inventory.json` — counts and parsing status, without raw content;
- `sample-manifest.json` — opaque IDs, selection reasons, and random seed;
- `open-codes.jsonl` — one evidence-linked review record per sampled trace;
- `failure-taxonomy.md` — the human-approved categories and counts;
- `eval-candidates.md` — ranked evaluator or direct-fix candidates; and
- `taskset-recommendation.md` — optional mappings to workshop Tasksets.

Continue reviewing in batches. If the corpus supports it, review at least 100
traces. After that, you may stop when 20 consecutive reviewed traces produce no
new failure category. If fewer than 100 usable traces exist, review all of them
and state the smaller denominator.

Finish with a concise summary that separates:

- observed facts;
- human-approved interpretations;
- model-assisted estimates;
- unresolved uncertainty; and
- the next controlled experiment this evidence supports.
```

## Evidence limit

Clustering helps a reviewer find repeated patterns. It does not prove why a
failure occurred, that a harness caused it, or that the reviewed sample
represents every trace. Use the result to choose the next evaluation or
experiment, not to rank agents from retrospective evidence.
