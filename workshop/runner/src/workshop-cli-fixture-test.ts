import assert from "node:assert/strict";
import { buildExperimentCard, parseSafeAuthResult, publicText } from "./workshop-cli.js";

assert.deepEqual(
	parseSafeAuthResult('npm warning\n{"status":"ready","provider":"openai-codex","authType":"oauth"}\n'),
	{ status: "ready", provider: "openai-codex", authType: "oauth" },
);
assert.deepEqual(parseSafeAuthResult("warning only"), {});
assert.equal(publicText("Require the public task contract before editing.", "Mechanism"), "Require the public task contract before editing.");
for (const unsafe of [
	`Read /${"Users"}/example/private.txt before editing.`,
	`Read /${"tmp"}/private.txt before editing.`,
	"Contact participant@example.com before editing.",
	"Use https://private.example before editing.",
	"Use Bearer secret-value before editing.",
	`Use ${"sk"}-${"proj"}-${"abcdefghijklmnopqrstuvwxyz"} before editing.`,
]) {
	assert.throws(() => publicText(unsafe, "Evidence"), /appears to contain private data/);
}

const card = buildExperimentCard({
	pairId: "pair-fixture",
	fixedControlCount: 24,
	decision: { classification: "missing-context", evidence: "The public contract was not read first.", mechanism: "Require the public contract before editing." },
	baselineStatus: "COMPLETE",
	baselineReward: { gate: { score: 1, weight: 1 } },
	changedStatus: "COMPLETE",
	changedReward: { gate: { score: 1, weight: 1 } },
	baselineSummary: "observable actions:\n01. read: src/example.ts",
	changedSummary: "observable actions:\n01. read: TASK.md",
	claim: "The observable sequence changed in this pair.",
	uncertainty: "One pair does not establish general benefit.",
});
assert.match(card, /Fixed controls: 24 rows matched/);
assert.match(card, /Raw traces remain private local data/);
assert.doesNotMatch(card, /\/Users\//);
console.log("agent-native workshop privacy and auth fixture tests passed");
