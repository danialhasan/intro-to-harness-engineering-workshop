import assert from "node:assert/strict";
import { buildImportPlan, type ImportRecord } from "../src/import-plan.js";

const records: ImportRecord[] = Array.from({ length: 51 }, (_, index) => ({ id: `r-${index}`, value: String(index) }));
const plan = buildImportPlan(records, "tenant-a");

assert.equal(plan.endpoint, "/v2/records");
assert.equal(plan.headers["x-tenant-id"], "tenant-a");
assert.deepEqual(plan.batches.map((batch) => batch.length), [50, 1]);
console.log("Participant-visible context-contract tests passed.");
