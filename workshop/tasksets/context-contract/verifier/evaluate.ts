import assert from "node:assert/strict";
import * as participant from "../src/import-plan.js";
import * as reference from "../reference/import-plan.js";

const target = process.argv.includes("--target") ? process.argv[process.argv.indexOf("--target") + 1] : "participant";
if (target !== "participant" && target !== "reference") throw new Error("--target must be participant or reference");
const implementation = target === "reference" ? reference : participant;
type Check = { id: string; pass: boolean; detail: string };

async function check(id: string, action: () => void): Promise<Check> {
  try { action(); return { id, pass: true, detail: "PASS" }; }
  catch (error) { return { id, pass: false, detail: error instanceof Error ? error.message : String(error) }; }
}

const records = Array.from({ length: 121 }, (_, index) => ({ id: `r-${index}`, value: String(index) }));
const checks = await Promise.all([
  check("contract_route_and_header", () => {
    const plan = implementation.buildImportPlan(records.slice(0, 1), "tenant-a");
    assert.equal(plan.endpoint, "/v2/records");
    assert.deepEqual(plan.headers, { "x-tenant-id": "tenant-a" });
  }),
  check("bounded_batches", () => {
    const plan = implementation.buildImportPlan(records, "tenant-a");
    assert.deepEqual(plan.batches.map((batch) => batch.length), [50, 50, 21]);
  }),
  check("preserves_record_order", () => {
    const flattened = implementation.buildImportPlan(records, "tenant-a").batches.flat();
    assert.deepEqual(flattened.map((record) => record.id), records.map((record) => record.id));
  }),
  check("rejects_blank_tenant", () => {
    assert.throws(() => implementation.buildImportPlan([], "   "));
  }),
]);

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.pass ? "" : `: ${result.detail}`}`);
const passed = checks.every((result) => result.pass);
console.log(`RESULT ${passed ? "PASS" : "FAIL"} target=${target}`);
if (!passed) process.exitCode = 1;
