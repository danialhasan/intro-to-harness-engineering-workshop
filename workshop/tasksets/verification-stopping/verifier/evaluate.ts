import assert from "node:assert/strict";
import * as participant from "../src/release-decision.js";
import * as reference from "../reference/release-decision.js";

const target = process.argv.includes("--target") ? process.argv[process.argv.indexOf("--target") + 1] : "participant";
if (target !== "participant" && target !== "reference") throw new Error("--target must be participant or reference");
const implementation = target === "reference" ? reference : participant;
type Check = { id: string; pass: boolean; detail: string };

async function check(id: string, action: () => void): Promise<Check> {
  try { action(); return { id, pass: true, detail: "PASS" }; }
  catch (error) { return { id, pass: false, detail: error instanceof Error ? error.message : String(error) }; }
}

const passing = [
  { name: "build", status: "pass" as const },
  { name: "test", status: "pass" as const },
  { name: "security", status: "pass" as const },
];
const checks = await Promise.all([
  check("missing_check_blocks", () => {
    const result = implementation.decideRelease(passing.slice(0, 2), "sha-a", "sha-a");
    assert.deepEqual(result, { status: "blocked", reason: "missing check: security" });
  }),
  check("failed_check_blocks", () => {
    const result = implementation.decideRelease(passing.map((item) => item.name === "test" ? { ...item, status: "fail" as const } : item), "sha-a", "sha-a");
    assert.deepEqual(result, { status: "blocked", reason: "failed check: test" });
  }),
  check("digest_mismatch_blocks", () => {
    const result = implementation.decideRelease(passing, "sha-produced", "sha-approved");
    assert.deepEqual(result, { status: "blocked", reason: "artifact digest mismatch" });
  }),
  check("complete_evidence_releases", () => {
    const result = implementation.decideRelease(passing, "sha-a", "sha-a");
    assert.deepEqual(result, { status: "ready", marker: "release:sha-a" });
  }),
]);

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.pass ? "" : `: ${result.detail}`}`);
const passed = checks.every((result) => result.pass);
console.log(`RESULT ${passed ? "PASS" : "FAIL"} target=${target}`);
if (!passed) process.exitCode = 1;
