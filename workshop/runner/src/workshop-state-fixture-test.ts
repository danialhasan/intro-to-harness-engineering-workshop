import assert from "node:assert/strict";
import { assertStage, isWorkshopSession, nextAction, type WorkshopSession } from "./workshop-state.js";

const session: WorkshopSession = {
	schemaVersion: "agent-native-workshop/v1",
	pairId: "pair-fixture",
	stage: "started",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

assert.equal(isWorkshopSession(session), true);
assert.equal(isWorkshopSession({ ...session, stage: "invented" }), false);
assert.doesNotThrow(() => assertStage(session, "started"));
assert.throws(() => assertStage(session, "ready"), /requires stage ready; current stage is started/);
assert.match(nextAction("baseline_complete"), /participant to choose/);
assert.match(nextAction("comparison_ready"), /limited claim/);
console.log("agent-native workshop state fixture tests passed");
