import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

type Action = {
	step: number;
	phase: string;
	action_kind: string;
	target: string;
	result: "OK" | "ERROR";
	started_monotonic_ms: number;
	ended_monotonic_ms: number;
	source_event_ids: string[];
};

export type RawEvent = {
	event_id?: string;
	type?: string;
	monotonic_ms?: number;
	reason?: string;
};

type CandidateRun = {
	candidate: "baseline" | "changed";
	runDir: string;
	manifest: Record<string, unknown>;
	run: Record<string, unknown>;
	evaluation: Record<string, unknown>;
	actions: Action[];
	rawEvents: RawEvent[];
	hashes: Record<string, string>;
};

export async function generateComparison(options: { comparison: string; baselineRunId: string; changedRunId: string; runRoot?: string }): Promise<{ comparisonDir: string; summaryPath: string; alignmentPath: string }> {
	const runRoot = resolve(options.runRoot ?? "runs");
	const comparisonDir = resolve(runRoot, options.comparison);
	if (relative(runRoot, comparisonDir).startsWith("..") || comparisonDir === runRoot) throw new Error("Comparison must remain inside --run-root.");
	const baseline = await findCandidate(comparisonDir, "baseline", options.baselineRunId);
	const changed = await findCandidate(comparisonDir, "changed", options.changedRunId);
	const controlLedger = fixedControlLedger(baseline.manifest, changed.manifest);
	const selection = { baseline_run_id: options.baselineRunId, changed_run_id: options.changedRunId };
	await writeFile(join(comparisonDir, "fixed-control-ledger.json"), `${JSON.stringify({ schema_version: "workshop-fixed-control-ledger/v1", selection, controls: controlLedger }, null, 2)}\n`);
	const drift = controlLedger.filter((entry) => entry.status !== "MATCH");
	if (drift.length > 0) throw new Error(`Invalid comparison: fixed controls differ or are missing: ${drift.map((entry) => entry.field).join(", ")}.`);
	const alignment = buildAlignment(baseline, changed);
	const summary = renderSummary(baseline, changed, alignment, controlLedger, selection);
	const alignmentPath = join(comparisonDir, "trace-alignment.json");
	const summaryPath = join(comparisonDir, "comparison-summary.md");
	await writeFile(alignmentPath, `${JSON.stringify({ schema_version: "workshop-trace-alignment/v1", comparison_id: options.comparison, baseline: runReference(baseline), changed: runReference(changed), anchors: alignment }, null, 2)}\n`);
	await writeFile(summaryPath, summary);
	return { comparisonDir, summaryPath, alignmentPath };
}

async function findCandidate(comparisonDir: string, candidate: "baseline" | "changed", runId: string): Promise<CandidateRun> {
	if (!isSafeRunId(runId)) throw new Error(`${candidate} run ID must be one safe path segment.`);
	const runDir = join(comparisonDir, candidate, runId);
	try { await access(runDir); } catch { throw new Error(`Requested ${candidate} run does not exist: ${runId}.`); }
	const [manifest, run, evaluation, actions, rawEvents] = await Promise.all([
		readJson(join(runDir, "comparison-manifest.json")),
		readJson(join(runDir, "run.json")),
		readJson(join(runDir, "evaluation-report.json")),
		readJsonl<Action>(join(runDir, "normalized-actions.jsonl")),
		readJsonl<RawEvent>(join(runDir, "raw-events.jsonl")),
	]);
	if (manifest.comparison_id !== basename(comparisonDir) || manifest.candidate_id !== candidate || manifest.run_id !== runId) {
		throw new Error(`Requested ${candidate} run manifest does not match comparison, candidate, and run ID.`);
	}
	return {
		candidate,
		runDir,
		manifest,
		run,
		evaluation,
		actions,
		rawEvents,
		hashes: {
			raw_events_sha256: await sha256(join(runDir, "raw-events.jsonl")),
			normalized_actions_sha256: await sha256(join(runDir, "normalized-actions.jsonl")),
			evaluation_report_sha256: await sha256(join(runDir, "evaluation-report.json")),
			final_tree_sha256: stringField(run, "final_tree_sha256") ?? "UNKNOWN",
		},
	};
}

const FIXED_CONTROL_FIELDS = [
	"schema_version", "comparison_id", "task_id", "fixture", "initial_tree_sha256", "task_prompt_sha256", "mode",
	"model.provider", "model.id", "model.thinking_level", "runtime_version",
	"evaluator_version", "evaluator_report_schema", "evaluator_source_sha256", "evaluator_config_sha256", "package_lock_sha256", "runner_package_lock_sha256",
	"allowed_tools", "model_timeout_ms", "operator_protocol",
	"allowed_path_boundary.enforcement", "network_policy",
	"resource_loader_isolation", "runner_contract_sha256", "harness_configuration_hashes.baseline",
	"sampling_seed",
] as const;

const DECISIVE_CONTROL_FIELDS = new Set<string>([
	"schema_version", "task_prompt_sha256", "runtime_version", "evaluator_version", "evaluator_report_schema", "evaluator_source_sha256", "evaluator_config_sha256", "package_lock_sha256", "runner_package_lock_sha256", "allowed_tools", "model_timeout_ms", "operator_protocol", "allowed_path_boundary.enforcement", "network_policy", "resource_loader_isolation", "runner_contract_sha256", "harness_configuration_hashes.baseline",
]);

export function fixedControlLedger(baseline: Record<string, unknown>, changed: Record<string, unknown>) {
	return FIXED_CONTROL_FIELDS.map((field) => {
		const baselineValue = atPath(baseline, field);
		const changedValue = atPath(changed, field);
		const missing = baselineValue === undefined || changedValue === undefined;
		const unknown = DECISIVE_CONTROL_FIELDS.has(field) && (baselineValue === "UNKNOWN" || changedValue === "UNKNOWN" || baselineValue === "PENDING_REPORT" || changedValue === "PENDING_REPORT");
		return { field, baseline: baselineValue ?? "MISSING", changed: changedValue ?? "MISSING", status: missing || unknown ? "MISSING" : JSON.stringify(baselineValue) === JSON.stringify(changedValue) ? "MATCH" : "DIFF" };
	});
}

function buildAlignment(baseline: CandidateRun, changed: CandidateRun) {
	return [
		{ anchor: "first_action", baseline: actionReference(baseline.actions[0]), changed: actionReference(changed.actions[0]) },
		{ anchor: "first_repository_search", baseline: actionReference(baseline.actions.find((action) => action.action_kind === "search")), changed: actionReference(changed.actions.find((action) => action.action_kind === "search")) },
		{ anchor: "first_relevant_edit", baseline: actionReference(baseline.actions.find((action) => action.action_kind === "edit")), changed: actionReference(changed.actions.find((action) => action.action_kind === "edit")) },
		{ anchor: "first_acceptance_check", baseline: actionReference(baseline.actions.find((action) => action.action_kind === "test")), changed: actionReference(changed.actions.find((action) => action.action_kind === "test")) },
		{ anchor: "first_failed_action", baseline: actionReference(baseline.actions.find((action) => action.result === "ERROR")), changed: actionReference(changed.actions.find((action) => action.result === "ERROR")) },
		{ anchor: "termination", baseline: runStoppedReference(baseline.rawEvents), changed: runStoppedReference(changed.rawEvents) },
	];
}

function renderSummary(baseline: CandidateRun, changed: CandidateRun, alignment: ReturnType<typeof buildAlignment>, controls: ReturnType<typeof fixedControlLedger>, selection: { baseline_run_id: string; changed_run_id: string }): string {
	const baselineProfile = profile(baseline.actions);
	const changedProfile = profile(changed.actions);
	return [
		"# Controlled Harness Comparison",
		"",
		"## Fixed contract",
		"",
		`- Selected baseline run: ${selection.baseline_run_id}`,
		`- Selected changed run: ${selection.changed_run_id}`,
		`- Task: ${stringField(baseline.manifest, "task_id") ?? "UNKNOWN"}`,
		`- Fixture: ${stringField(baseline.manifest, "fixture") ?? "UNKNOWN"}`,
		`- Model: ${modelLabel(baseline.manifest)}`,
		`- Starting tree SHA-256: ${stringField(baseline.manifest, "initial_tree_sha256") ?? "UNKNOWN"}`,
		`- Baseline H SHA-256: ${stringField(baseline.manifest, "harness_configuration_sha256") ?? "UNKNOWN"}`,
		`- Changed H SHA-256: ${stringField(changed.manifest, "harness_configuration_sha256") ?? "UNKNOWN"}`,
		"",
		"## Fixed-control ledger",
		"",
		"| Field | Baseline | Changed | Status |",
		"| --- | --- | --- | --- |",
		...controls.map((entry) => `| ${entry.field} | ${formatControl(entry.baseline)} | ${formatControl(entry.changed)} | ${entry.status} |`),
		"",
		"## Results",
		"",
		"| Dimension | Baseline | Changed harness |",
		"| --- | --- | --- |",
		`| completion status | ${completionStatus(baseline.evaluation)} | ${completionStatus(changed.evaluation)} |`,
		`| termination status | ${stringField(baseline.run, "termination_status") ?? "UNKNOWN"} | ${stringField(changed.run, "termination_status") ?? "UNKNOWN"} |`,
		`| first edit | ${formatAction(firstOfKind(baseline.actions, "edit"))} | ${formatAction(firstOfKind(changed.actions, "edit"))} |`,
		`| action classes | ${formatClasses(baselineProfile.actionClasses)} | ${formatClasses(changedProfile.actionClasses)} |`,
		`| failed actions | ${formatFailures(baselineProfile.failedActions)} | ${formatFailures(changedProfile.failedActions)} |`,
		`| trace elapsed ms | ${baselineProfile.elapsedMs} | ${changedProfile.elapsedMs} |`,
		"",
		"## Evaluator results",
		"",
		`- Baseline: ${formatGates(baseline.evaluation)}`,
		`- Changed: ${formatGates(changed.evaluation)}`,
		"",
		"## Observable trace alignment",
		"",
		"Unmatched anchors are `null`. This file does not fabricate symmetry.",
		"",
		"| Anchor | Baseline | Changed harness |",
		"| --- | --- | --- |",
		...alignment.map((entry) => `| ${entry.anchor} | ${formatReference(entry.baseline)} | ${formatReference(entry.changed)} |`),
		"",
		"## Artifact hashes",
		"",
		"| Candidate | Raw trace | Normalized actions | Evaluator report | Final tree |",
		"| --- | --- | --- | --- | --- |",
		`| baseline | ${baseline.hashes.raw_events_sha256} | ${baseline.hashes.normalized_actions_sha256} | ${baseline.hashes.evaluation_report_sha256} | ${baseline.hashes.final_tree_sha256} |`,
		`| changed | ${changed.hashes.raw_events_sha256} | ${changed.hashes.normalized_actions_sha256} | ${changed.hashes.evaluation_report_sha256} | ${changed.hashes.final_tree_sha256} |`,
		"",
	].join("\n");
}

function profile(actions: Action[]) {
	const actionClasses: Record<string, number> = {};
	for (const action of actions) actionClasses[action.action_kind] = (actionClasses[action.action_kind] ?? 0) + 1;
	const failedActions = actions.filter((action) => action.result === "ERROR");
	const starts = actions.map((action) => action.started_monotonic_ms);
	const ends = actions.map((action) => action.ended_monotonic_ms);
	return { actionClasses, failedActions, elapsedMs: starts.length ? Math.max(...ends) - Math.min(...starts) : "UNKNOWN" };
}

function actionReference(action: Action | undefined) {
	return action ? { step: action.step, action_kind: action.action_kind, target: action.target, result: action.result, source_event_ids: action.source_event_ids } : null;
}

function runReference(run: CandidateRun) {
	return { run_id: stringField(run.manifest, "run_id") ?? "UNKNOWN", run_dir: run.runDir, hashes: run.hashes };
}

function firstOfKind(actions: Action[], actionKind: string) {
	return actions.find((action) => action.action_kind === actionKind);
}

function formatAction(action: Action | undefined): string {
	return action ? `step ${action.step}: ${action.target} [${action.source_event_ids.join(", ")}]` : "NONE";
}

function formatClasses(classes: Record<string, number>): string {
	return Object.entries(classes).map(([kind, count]) => `${kind}:${count}`).join(", ") || "NONE";
}

function formatFailures(actions: Action[]): string {
	return actions.length ? actions.map((action) => `step ${action.step} ${action.action_kind} [${action.source_event_ids.join(", ")}]`).join("; ") : "NONE";
}

export function runStoppedReference(rawEvents: RawEvent[]) {
	const event = [...rawEvents].reverse().find((candidate) => candidate.type === "run_stopped");
	return event?.event_id ? { event_id: event.event_id, type: "run_stopped", monotonic_ms: event.monotonic_ms ?? "UNKNOWN", reason: event.reason ?? "UNKNOWN" } : null;
}

function formatReference(reference: ReturnType<typeof actionReference> | ReturnType<typeof runStoppedReference>): string {
	if (!reference) return "null";
	if ("event_id" in reference) return `raw ${reference.event_id}: run_stopped ${reference.reason}`;
	return `step ${reference.step}: ${reference.action_kind} ${reference.target} [${reference.source_event_ids.join(", ")}]`;
}

function completionStatus(report: Record<string, unknown>): string {
	return stringField(report, "completion_status") ?? "UNKNOWN";
}

function formatGates(report: Record<string, unknown>): string {
	const gates = report.hard_gates;
	if (Array.isArray(gates)) return gates.map((gate) => {
		const value = gate && typeof gate === "object" ? gate as Record<string, unknown> : {};
		return `${stringField(value, "id") ?? "UNKNOWN"}:${stringField(value, "status") ?? "UNKNOWN"}`;
	}).join(", ");
	if (gates && typeof gates === "object") return Object.entries(gates as Record<string, unknown>).map(([id, status]) => `${id}:${String(status)}`).join(", ");
	return "UNKNOWN";
}

function modelLabel(manifest: Record<string, unknown>): string {
	const model = recordField(manifest, "model");
	return `${stringField(model, "provider") ?? "UNKNOWN"}/${stringField(model, "id") ?? "UNKNOWN"} (${stringField(model, "thinking_level") ?? "UNKNOWN"})`;
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = record[key];
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function atPath(record: Record<string, unknown>, path: string): unknown {
	let current: unknown = record;
	for (const part of path.split(".")) {
		if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function formatControl(value: unknown): string {
	const rendered = typeof value === "string" ? value : JSON.stringify(value);
	return (rendered ?? "MISSING").replaceAll("|", "\\|");
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	return typeof record[key] === "string" ? record[key] as string : undefined;
}

async function readJson(path: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function readJsonl<T>(path: string): Promise<T[]> {
	const contents = await readFile(path, "utf8");
	return contents.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function sha256(path: string): Promise<string> {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}

function parseArgs(argv: string[]): { comparison: string; baselineRunId: string; changedRunId: string; runRoot?: string } {
	const values = new Map<string, string>();
	for (let index = 0; index < argv.length; index += 2) {
		const key = argv[index];
		const value = argv[index + 1];
		if (!key?.startsWith("--") || value === undefined) throw new Error("Usage: npm run compare -- --comparison <id> --baseline-run-id <id> --changed-run-id <id> [--run-root <path>]");
		values.set(key.slice(2), value);
	}
	const comparison = values.get("comparison");
	const baselineRunId = values.get("baseline-run-id");
	const changedRunId = values.get("changed-run-id");
	if (!comparison || !baselineRunId || !changedRunId) throw new Error("Usage: npm run compare -- --comparison <id> --baseline-run-id <id> --changed-run-id <id> [--run-root <path>]");
	return { comparison, baselineRunId, changedRunId, runRoot: values.get("run-root") };
}

function isSafeRunId(value: string): boolean {
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const result = await generateComparison(parseArgs(process.argv.slice(2)));
	console.log(JSON.stringify(result, null, 2));
}
