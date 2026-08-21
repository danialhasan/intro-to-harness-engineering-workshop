import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { VARIANTS, type Variant } from "./workshop-state.js";

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

function variant(input: string): Variant {
	if (!VARIANTS.includes(input as Variant)) throw new Error("variant must be h0, h1, h2, h3, or h4");
	return input as Variant;
}

async function json(path: string): Promise<Record<string, any>> { return JSON.parse(await readFile(path, "utf8")); }

export function buildFixedControlLedger(left: Record<string, any>, right: Record<string, any>): Array<{ control: string; left: unknown; right: unknown; status: "MATCH" | "MISMATCH" }> {
	const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
	return keys.map((key) => ({ control: key, left: left[key] ?? null, right: right[key] ?? null, status: JSON.stringify(left[key]) === JSON.stringify(right[key]) ? "MATCH" : "MISMATCH" }));
}

export async function compareAdjacent(ladderId: string, leftVariant: Variant, leftRunId: string, rightVariant: Variant, rightRunId: string): Promise<{ valid: boolean; fixedControlCount: number; policyDifferent: boolean }> {
	const root = resolve("runs", ladderId);
	const left = await json(resolve(root, leftVariant, leftRunId, "workshop-run.json"));
	const right = await json(resolve(root, rightVariant, rightRunId, "workshop-run.json"));
	if (left.comparison_id !== ladderId || right.comparison_id !== ladderId || left.variant !== leftVariant || right.variant !== rightVariant) throw new Error("run identity does not match the requested ladder");
	const rows = buildFixedControlLedger(left.fixed_controls ?? {}, right.fixed_controls ?? {});
	const policyDifferent = left.policy_sha256 !== right.policy_sha256;
	const valid = rows.every((row) => row.status === "MATCH") && policyDifferent;
	const file = resolve(root, `fixed-controls-${leftVariant}-to-${rightVariant}.json`);
	await writeFile(file, `${JSON.stringify({ schema_version: "prime-adjacent-controls/v2", ladder_id: ladderId, left: leftVariant, right: rightVariant, valid, policy_controlled_difference: policyDifferent ? "DIFFERENT" : "SAME", rows }, null, 2)}\n`);
	return { valid, fixedControlCount: rows.length, policyDifferent };
}

async function main(): Promise<void> {
	const ladderId = safe(value("ladder"));
	const leftVariant = variant(value("left"));
	const rightVariant = variant(value("right"));
	const result = await compareAdjacent(ladderId, leftVariant, safe(value("left-run-id")), rightVariant, safe(value("right-run-id")));
	console.log(JSON.stringify({ ladderId, leftVariant, rightVariant, ...result }, null, 2));
	if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
