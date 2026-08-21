import assert from "node:assert/strict";
import { buildExperimentCard, parseSafeAuthResult, publicText } from "./workshop-cli.js";

assert.deepEqual(parseSafeAuthResult('npm warning\n{"status":"ready","provider":"openai-codex","authType":"oauth"}\n'), { status: "ready", provider: "openai-codex", authType: "oauth" });
assert.deepEqual(parseSafeAuthResult("warning only"), {});
assert.equal(publicText("Require the public task contract before editing.", "Mechanism"), "Require the public task contract before editing.");
for (const unsafe of [`Read /${"Users"}/example/private.txt before editing.`, `Read /${"tmp"}/private.txt before editing.`, "Contact participant@example.com before editing.", "Use https://private.example before editing.", "Use Bearer secret-value before editing.", `Use ${"sk"}-${"proj"}-${"abcdefghijklmnopqrstuvwxyz"} before editing.`]) assert.throws(() => publicText(unsafe, "Evidence"), /appears to contain private data/);
const card = buildExperimentCard({ ladderId: "ladder-fixture", fixedControlCount: 24, table: "| H0 | COMPLETE |\n| H4 | COMPLETE |", decision: { classification: "missing-context", evidence: "The public contract was not read first.", mechanism: "Require a concise plan before editing.", source: "author-simulation" }, claim: "The observable sequence changed in this ladder.", uncertainty: "One ladder does not establish general benefit." });
assert.match(card, /Fixed controls: 24 rows matched in every adjacent comparison/);
assert.match(card, /Author-simulation H4 decision/);
assert.match(card, /not evidence that an attendee completed/);
assert.match(card, /Raw traces and credentials remain private/);
assert.doesNotMatch(card, /\/Users\//);
assert.doesNotMatch(card, /https?:\/\//);
console.log("agent-native harness ladder privacy and auth fixture tests passed");
