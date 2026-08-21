export const STAGES = [
	"started",
	"ready",
	"baseline_complete",
	"decision_recorded",
	"changed_complete",
	"comparison_ready",
	"complete",
] as const;

export type WorkshopStage = (typeof STAGES)[number];

export type RunRecord = {
	runId: string;
	runDir: string;
	completionStatus: string;
	summaryFile: string;
};

export type WorkshopDecision = {
	classification: string;
	evidence: string;
	mechanism: string;
	source: "participant" | "author-simulation";
};

export type WorkshopSession = {
	schemaVersion: "agent-native-workshop/v1";
	pairId: string;
	stage: WorkshopStage;
	createdAt: string;
	updatedAt: string;
	baseline?: RunRecord;
	decision?: WorkshopDecision;
	changed?: RunRecord;
	cardFile?: string;
};

const NEXT: Record<WorkshopStage, string> = {
	started: "Run npm run workshop:doctor. If OpenAI OAuth is not ready, complete the private login handoff first.",
	ready: "Run npm run workshop:baseline.",
	baseline_complete: "Review the safe baseline summary. Ask the participant to choose one evidence-linked mechanism, then record it with npm run workshop:record-decision.",
	decision_recorded: "Edit only the marked policy text, run npm run check:policy, then run npm run workshop:changed.",
	changed_complete: "Run npm run workshop:compare.",
	comparison_ready: "Review the comparison with the participant. Ask for a limited claim and uncertainty, then run npm run workshop:finish.",
	complete: "The experiment card is complete. Review it, reset the policy when ready, and continue with another safe Taskset.",
};

export function nextAction(stage: WorkshopStage): string {
	return NEXT[stage];
}

export function assertStage(session: WorkshopSession, expected: WorkshopStage): void {
	if (session.stage !== expected) {
		throw new Error(`This command requires stage ${expected}; current stage is ${session.stage}. ${nextAction(session.stage)}`);
	}
}

export function isWorkshopSession(value: unknown): value is WorkshopSession {
	if (!value || typeof value !== "object") return false;
	const session = value as Partial<WorkshopSession>;
	return session.schemaVersion === "agent-native-workshop/v1"
		&& typeof session.pairId === "string"
		&& typeof session.stage === "string"
		&& STAGES.includes(session.stage as WorkshopStage)
		&& typeof session.createdAt === "string"
		&& typeof session.updatedAt === "string";
}
