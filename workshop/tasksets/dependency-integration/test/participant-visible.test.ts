import assert from "node:assert/strict";
import { planRelease } from "../src/release-plan.js";

const order = planRelease([
  { name: "api", enabled: true, dependsOn: ["database"] },
  { name: "database", enabled: true, dependsOn: [] },
  { name: "preview", enabled: false, dependsOn: [] },
]);

assert.deepEqual(order, ["database", "api"]);
assert.equal(order.includes("preview"), false);
console.log("Participant-visible dependency-integration tests passed.");
