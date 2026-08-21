import type { ActionSummary, HarnessDecision, HarnessRunInput, WorkshopHarness } from "../src/types.js";

const baseTools = ["read", "grep", "find", "ls", "edit", "write", "bash"];
const noGate = (reason: string): HarnessDecision => ({ continue: false, reason });

// PARTICIPANT EDIT START
// Change only the instruction strings in this array. Keep the change small.
const participantChangedRules = [
	"Inspect the relevant implementation and tests before the first edit.",
	"Before you claim completion, run the task-relevant verification command and use its observed result as evidence.",
];
// PARTICIPANT EDIT END

export const baselineHarness: WorkshopHarness = {
	id: "baseline",
	buildContext(_input: HarnessRunInput): string {
		return ["Workshop harness rules: work only in the current repository.", "Make the smallest coherent change. Report observed evidence for your result."].join("\n\n");
	},
	allowedTools: () => baseTools,
	shouldVerify: () => noGate("Baseline has no harness verification gate."),
	shouldContinue: () => noGate("Baseline accepts Pi's first stop decision."),
};

export const changedHarness: WorkshopHarness = {
	id: "changed",
	buildContext(_input: HarnessRunInput): string {
		return ["Workshop harness rules: work only in the current repository.", ...participantChangedRules, "Do not change tests or evaluator files. Do not use network tools or external services."].join("\n\n");
	},
	allowedTools: () => baseTools,
	shouldVerify(summary: ActionSummary): HarnessDecision {
		if (summary.verificationObserved) return noGate("A verification action is observable in the trace.");
		return { continue: true, reason: "No observable verification action occurred before Pi stopped.", followUp: "Completion gate: do not report done yet. Run the task-relevant verification command now, inspect the result, and then state whether the task is complete." };
	},
	shouldContinue(summary: ActionSummary): HarnessDecision {
		return summary.completedActions.some((action) => action.actionKind === "edit") ? noGate("A relevant edit is observable; the fixed evaluator will now decide correctness.") : noGate("No edit is observable; do not invent a hidden-state conclusion.");
	},
};

export function selectHarness(id: "baseline" | "changed"): WorkshopHarness {
	return id === "baseline" ? baselineHarness : changedHarness;
}
