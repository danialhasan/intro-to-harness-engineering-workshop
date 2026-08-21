import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function value(name: string): string {
	const index = process.argv.indexOf(`--${name}`);
	const found = index >= 0 ? process.argv[index + 1] : undefined;
	if (!found) throw new Error(`--${name} is required`);
	return found;
}

function safe(input: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input)) throw new Error("IDs must be safe path segments");
	return input;
}

async function json(path: string): Promise<Record<string, any>> { return JSON.parse(await readFile(path, "utf8")); }

function actions(episode: Record<string, any>): string[] {
	const trace = episode.traces?.[0] ?? episode;
	const result: string[] = [];
	for (const node of trace.nodes ?? []) {
		for (const call of node.message?.tool_calls ?? []) result.push(String(call.name ?? call.function?.name ?? "tool"));
	}
	return result;
}

async function lastEpisode(path: string): Promise<Record<string, any>> {
	const lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean);
	return JSON.parse(lines.at(-1) ?? "{}");
}

export function buildFixedControlLedger(baseline: Record<string, any>, changed: Record<string, any>): Array<{ control: string; baseline: unknown; changed: unknown; status: "MATCH" | "MISMATCH" }> {
	const keys = Array.from(new Set([...Object.keys(baseline), ...Object.keys(changed)])).sort();
	return keys.map((key) => ({ control: key, baseline: baseline[key] ?? null, changed: changed[key] ?? null, status: JSON.stringify(baseline[key]) === JSON.stringify(changed[key]) ? "MATCH" : "MISMATCH" }));
}

async function main(): Promise<void> {
	const comparison = safe(value("comparison"));
	const baselineId = safe(value("baseline-run-id"));
	const changedId = safe(value("changed-run-id"));
	const root = resolve("runs", comparison);
	const baselineDir = resolve(root, "baseline", baselineId);
	const changedDir = resolve(root, "changed", changedId);
	const baseline = await json(resolve(baselineDir, "workshop-run.json"));
	const changed = await json(resolve(changedDir, "workshop-run.json"));
	if (baseline.comparison_id !== comparison || changed.comparison_id !== comparison || baseline.candidate !== "baseline" || changed.candidate !== "changed") throw new Error("run identity does not match the requested pair");
	const ledger = buildFixedControlLedger(baseline.fixed_controls ?? {}, changed.fixed_controls ?? {});
	const valid = ledger.every((row) => row.status === "MATCH") && baseline.policy_sha256 !== changed.policy_sha256;
	await writeFile(resolve(root, "fixed-control-ledger.json"), `${JSON.stringify({ schema_version: "prime-fixed-controls/v1", comparison_id: comparison, valid, policy_controlled_difference: baseline.policy_sha256 !== changed.policy_sha256 ? "DIFFERENT" : "SAME", rows: ledger }, null, 2)}\n`);
	const baselineEpisode = await lastEpisode(resolve(baselineDir, "traces.jsonl"));
	const changedEpisode = await lastEpisode(resolve(changedDir, "traces.jsonl"));
	const baselineActions = actions(baselineEpisode);
	const changedActions = actions(changedEpisode);
	const summary = `# Prime workshop comparison\n\n- Pair: \`${comparison}\`\n- Fixed controls: **${valid ? "MATCH" : "INVALID"}**\n- Baseline evaluator: **${baseline.completion_status}**\n- Changed evaluator: **${changed.completion_status}**\n- Baseline observable tool sequence: \`${baselineActions.join(" -> ") || "none recorded"}\`\n- Changed observable tool sequence: \`${changedActions.join(" -> ") || "none recorded"}\`\n\nThe policy file was the declared controlled difference. This pair shows observed trajectory and scorer outcomes only. It does not prove that either harness is generally better.\n`;
	await writeFile(resolve(root, "comparison-summary.md"), summary);
	console.log(JSON.stringify({ comparison, valid, fixedControls: ledger.length, baselineStatus: baseline.completion_status, changedStatus: changed.completion_status }, null, 2));
	if (!valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
