export type CandidateId = "baseline" | "changed";
export type RunMode = "pi" | "fixture";

export type Phase = "OBSERVE" | "PLAN" | "ACT" | "VERIFY" | "RECOVER" | "STOP" | "UNKNOWN";
export type ActionKind =
	| "read"
	| "search"
	| "inspect"
	| "edit"
	| "execute"
	| "test"
	| "version_control"
	| "network"
	| "delegate"
	| "message_human"
	| "terminate"
	| "other";

export interface HarnessRunInput {
	taskId: string;
	taskPrompt: string;
	worktree: string;
}

export interface ActionSummary {
	completedActions: ReadonlyArray<{ actionKind: ActionKind; phase: Phase; result: "OK" | "ERROR" }>;
	verificationObserved: boolean;
}

export interface HarnessDecision {
	continue: boolean;
	reason: string;
	followUp?: string;
}

/**
 * This is the participant-editable harness surface. It intentionally controls
 * only what Pi receives, can call, and must demonstrate before it stops.
 */
export interface WorkshopHarness {
	id: CandidateId;
	buildContext(input: HarnessRunInput): string;
	allowedTools(): string[];
	shouldVerify(summary: ActionSummary): HarnessDecision;
	shouldContinue(summary: ActionSummary): HarnessDecision;
}

export interface RunnerOptions {
	fixture: string;
	taskId: string;
	candidate: CandidateId;
	mode: RunMode;
	runRoot: string;
	comparisonId: string;
	runId?: string;
	modelProvider: string;
	modelId: string;
	thinkingLevel: "off" | "low" | "medium" | "high";
	timeoutMs: number;
}
