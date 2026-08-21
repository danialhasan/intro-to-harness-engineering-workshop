import assert from "node:assert/strict";
import { buildFixedControlLedger } from "./prime-compare.js";

const fixed = { task: "retry-http/v1", model: "openai-codex/gpt-5.5", timeout: 420 };
assert.equal(buildFixedControlLedger(fixed, { ...fixed }).every((row) => row.status === "MATCH"), true);
const drift = buildFixedControlLedger(fixed, { ...fixed, model: "different/model" });
assert.equal(drift.find((row) => row.control === "model")?.status, "MISMATCH");
assert.equal(drift.every((row) => row.status === "MATCH"), false);
console.log("Prime fixed-control negative drift test passed");
