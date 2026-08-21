import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const comparison = `retry-fixture-${Date.now()}`;
const runId = `${comparison}-baseline-smoke`;
const runnerRoot = resolve(".smoke-runs");
const fixture = resolve("../candidates/retry-http");
const child = spawn(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "src/cli.ts", "--mode", "fixture", "--fixture", fixture, "--task", "retry-http-v1", "--candidate", "baseline", "--comparison", comparison, "--run-id", runId, "--run-root", runnerRoot], {
	stdio: "inherit",
});
const exitCode = await new Promise<number | null>((resolveExit) => child.on("close", resolveExit));
assert.equal(exitCode, 1, "The intentionally incomplete retry fixture must remain RED (runner exit 1).");
const candidateRoot = join(runnerRoot, comparison, "baseline");
const entries = await readdir(candidateRoot, { withFileTypes: true });
assert.deepEqual(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name), [runId], "The runner must create only the requested isolated run directory.");
const runDir = join(candidateRoot, runId);
const report = JSON.parse(await readFile(join(runDir, "evaluation-report.json"), "utf8")) as { completion_status?: string };
assert.notEqual(report.completion_status, "EVALUATOR_ERROR", "The evaluator must produce its own report.");
assert.equal(report.completion_status, "FAILED", "The starter retry implementation must stay RED.");
const raw = await readFile(join(runDir, "raw-events.jsonl"), "utf8");
const normalized = await readFile(join(runDir, "normalized-actions.jsonl"), "utf8");
assert.match(raw, /"type":"verifier_finished"/, "Raw trace must preserve evaluator lifecycle evidence.");
assert.match(normalized, /"schema_version":"workshop-trace\/v1"/, "Normalized actions must be present.");
console.log(`retry integration smoke passed: ${runDir}`);
