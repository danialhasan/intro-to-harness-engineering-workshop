import assert from "node:assert/strict";
import * as participant from "../src/release-plan.js";
import * as reference from "../reference/release-plan.js";

const target = process.argv.includes("--target") ? process.argv[process.argv.indexOf("--target") + 1] : "participant";
if (target !== "participant" && target !== "reference") throw new Error("--target must be participant or reference");
const implementation = target === "reference" ? reference : participant;
type Check = { id: string; pass: boolean; detail: string };

async function check(id: string, action: () => void): Promise<Check> {
  try { action(); return { id, pass: true, detail: "PASS" }; }
  catch (error) { return { id, pass: false, detail: error instanceof Error ? error.message : String(error) }; }
}

const checks = await Promise.all([
  check("dependencies_before_dependents", () => {
    const order = implementation.planRelease([
      { name: "web", enabled: true, dependsOn: ["api"] },
      { name: "api", enabled: true, dependsOn: ["database"] },
      { name: "database", enabled: true, dependsOn: [] },
    ]);
    assert.deepEqual(order, ["database", "api", "web"]);
  }),
  check("disabled_and_missing_dependencies", () => {
    assert.throws(() => implementation.planRelease([
      { name: "api", enabled: true, dependsOn: ["database"] },
      { name: "database", enabled: false, dependsOn: [] },
    ]));
  }),
  check("cycle_detection", () => {
    assert.throws(() => implementation.planRelease([
      { name: "api", enabled: true, dependsOn: ["worker"] },
      { name: "worker", enabled: true, dependsOn: ["api"] },
    ]));
  }),
  check("stable_independent_order", () => {
    const order = implementation.planRelease([
      { name: "worker", enabled: true, dependsOn: [] },
      { name: "api", enabled: true, dependsOn: [] },
      { name: "preview", enabled: false, dependsOn: [] },
    ]);
    assert.deepEqual(order, ["worker", "api"]);
  }),
]);

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.pass ? "" : `: ${result.detail}`}`);
const passed = checks.every((result) => result.pass);
console.log(`RESULT ${passed ? "PASS" : "FAIL"} target=${target}`);
if (!passed) process.exitCode = 1;
