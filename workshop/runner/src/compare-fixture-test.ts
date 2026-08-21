import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixedControlLedger, generateComparison, runStoppedReference } from "./compare.js";

const runRoot = await mkdtemp(join(tmpdir(), "pi-compare-fixture-"));
const comparison = "controlled";
const sharedManifest = {
	schema_version: "workshop-comparison/v1",
	comparison_id: comparison,
	task_id: "task",
	fixture: "/fixture",
	initial_tree_sha256: "start",
	task_prompt_sha256: "task-prompt",
	mode: "pi",
	model: { provider: "openai-codex", id: "gpt-5.5", thinking_level: "medium" },
	runtime_version: { node: "v26", pi_coding_agent: "0.83.0" },
	evaluator_version: "retry-http-evaluator/2.0.0",
	evaluator_report_schema: "workshop-eval/v1",
	evaluator_source_sha256: "eval-source",
	evaluator_config_sha256: "eval-config",
	package_lock_sha256: "lock",
	runner_package_lock_sha256: "runner-lock",
	allowed_tools: ["read", "bash"],
	model_timeout_ms: 420000,
	operator_protocol: "log operator action",
	allowed_path_boundary: { path: "/candidate-path", enforcement: "SYSTEM_RULE_ONLY" },
	network_policy: { enforcement: "NOT_ENFORCED_BY_RUNTIME" },
	resource_loader_isolation: { strategy: "explicit-resource-loader-overrides/v1" },
	runner_contract_sha256: "shared-runner-contract",
	harness_configuration_hashes: { baseline: "baseline-H", changed: "changed-H" },
	sampling_seed: "UNKNOWN",
};
async function writeRun(candidate: "baseline" | "changed", runId: string) {
	const runDir = join(runRoot, comparison, candidate, runId);
	await mkdir(runDir, { recursive: true });
	await writeFile(join(runDir, "comparison-manifest.json"), JSON.stringify({ ...sharedManifest, run_id: runId, candidate_id: candidate, harness_configuration_sha256: `${candidate}-H` }));
	await writeFile(join(runDir, "run.json"), JSON.stringify({ termination_status: "MODEL_STOPPED", final_tree_sha256: `${candidate}-tree` }));
	await writeFile(join(runDir, "evaluation-report.json"), JSON.stringify({ completion_status: "COMPLETE", hard_gates: { acceptance: "PASS" } }));
	await writeFile(join(runDir, "normalized-actions.jsonl"), JSON.stringify({ step: 1, phase: "ACT", action_kind: "edit", target: "src/a.ts", result: "OK", started_monotonic_ms: 1, ended_monotonic_ms: 2, source_event_ids: ["evt-1", "evt-2"] }) + "\n");
	await writeFile(join(runDir, "raw-events.jsonl"), JSON.stringify({ event_id: "evt-stop", type: "run_stopped", monotonic_ms: 3, reason: "MODEL_STOPPED" }) + "\n");
}
await writeRun("baseline", "baseline-requested");
await writeRun("changed", "changed-requested");
// These later archive directories would win under a modification-time selector.
await writeRun("baseline", "baseline-archived-later");
await writeRun("changed", "changed-archived-later");

const result = await generateComparison({ comparison, baselineRunId: "baseline-requested", changedRunId: "changed-requested", runRoot });
const summary = await readFile(result.summaryPath, "utf8");
assert.match(summary, /Controlled Harness Comparison/);
assert.match(summary, /Selected baseline run: baseline-requested/);
assert.match(summary, /Selected changed run: changed-requested/);
assert.match(await readFile(result.alignmentPath, "utf8"), /run_stopped/);
const ledger = JSON.parse(await readFile(join(runRoot, comparison, "fixed-control-ledger.json"), "utf8"));
assert.deepEqual(ledger.selection, { baseline_run_id: "baseline-requested", changed_run_id: "changed-requested" });
await assert.rejects(
	() => generateComparison({ comparison, baselineRunId: "changed-requested", changedRunId: "changed-requested", runRoot }),
	/Requested baseline run does not exist/,
);
await writeRun("baseline", "baseline-wrong-candidate");
await writeFile(
	join(runRoot, comparison, "baseline", "baseline-wrong-candidate", "comparison-manifest.json"),
	JSON.stringify({ ...sharedManifest, run_id: "baseline-wrong-candidate", candidate_id: "changed", harness_configuration_sha256: "baseline-H" }),
);
await assert.rejects(
	() => generateComparison({ comparison, baselineRunId: "baseline-wrong-candidate", changedRunId: "changed-requested", runRoot }),
	/manifest does not match comparison, candidate, and run ID/,
);
await assert.rejects(
	() => generateComparison({ comparison, baselineRunId: "../changed-requested", changedRunId: "changed-requested", runRoot }),
	/baseline run ID must be one safe path segment/,
);
assert.deepEqual(runStoppedReference([
	{ event_id: "evt-0001", type: "tool_result" },
	{ event_id: "evt-0002", type: "run_stopped", monotonic_ms: 42, reason: "TIMEOUT" },
]), { event_id: "evt-0002", type: "run_stopped", monotonic_ms: 42, reason: "TIMEOUT" });

for (const [label, mutate] of [
	["evaluator", (value: any) => (value.evaluator_source_sha256 = "changed")],
	["tools", (value: any) => (value.allowed_tools = ["read"])],
	["timeout", (value: any) => (value.model_timeout_ms = 1)],
	["authority", (value: any) => (value.network_policy.enforcement = "DENY")],
	["runtime", (value: any) => (value.runtime_version.pi_coding_agent = "other")],
	["isolation", (value: any) => (value.resource_loader_isolation.strategy = "other")],
	["baseline-h", (value: any) => (value.harness_configuration_hashes.baseline = "other")],
] as const) {
	const changed = structuredClone(sharedManifest) as any;
	mutate(changed);
	assert.ok(fixedControlLedger(sharedManifest, changed).some((entry) => entry.status === "DIFF"), `${label} drift must fail closed`);
}
const changedIntervention = structuredClone(sharedManifest) as any;
changedIntervention.harness_configuration_hashes.changed = "participant-edited-H";
changedIntervention.harness_configuration_sha256 = "participant-edited-H";
changedIntervention.participant_harness_source_sha256 = "participant-edited-source";
assert.ok(fixedControlLedger(sharedManifest, changedIntervention).every((entry) => entry.status === "MATCH"), "Changed-H and participant source changes are authorized intervention receipts.");
console.log("compare fixture test passed");
