import assert from "node:assert/strict";
import { decideRelease } from "../src/release-decision.js";

const checks = [
  { name: "build", status: "pass" as const },
  { name: "test", status: "pass" as const },
  { name: "security", status: "pass" as const },
];

assert.deepEqual(decideRelease(checks, "sha-123", "sha-123"), { status: "ready", marker: "release:sha-123" });
assert.equal(decideRelease(checks.slice(0, 2), "sha-123", "sha-123").status, "blocked");
console.log("Participant-visible verification-stopping tests passed.");
