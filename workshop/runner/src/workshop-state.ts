export const VARIANTS = ["h0", "h1", "h2", "h3", "h4"] as const;
export type Variant = (typeof VARIANTS)[number];

export const STAGES = ["started", "ready", "reference_complete", "decision_recorded", "h4_complete", "comparison_ready", "complete"] as const;
export type WorkshopStage = (typeof STAGES)[number];

export type MechanismEvidence = {
	readsContractBeforeFirstEdit: boolean;
	runsTestBeforeFirstEdit: boolean;
	verifiesAfterFinalEdit: boolean;
	actionCount: number;
	turns: number;
};

export type RunRecord = {
	variant: Variant;
	runId: string;
	runDir: string;
	completionStatus: string;
	summaryFile: string;
	evidence: MechanismEvidence;
};

export type WorkshopDecision = {
	classification: string;
	evidence: string;
	mechanism: string;
	source: "participant" | "author-simulation";
};

export type WorkshopSession = {
	schemaVersion: "agent-native-harness-ladder/v2";
	ladderId: string;
	stage: WorkshopStage;
	createdAt: string;
	updatedAt: string;
	runs: Partial<Record<Variant, RunRecord>>;
	decision?: WorkshopDecision;
	cardFile?: string;
};

const NEXT: Record<WorkshopStage, string> = {
	started: "Run npm run workshop:doctor. If OpenAI OAuth is not ready, complete the private login handoff first.",
	ready: "Run npm run workshop:ladder. It resumes safely and runs only missing H0-H3 variants.",
	reference_complete: "Review the H0-H3 ladder. Ask the participant to choose one additional H4 mechanism, then record it.",
	decision_recorded: "Edit only the marked H4 policy text, validate it, then run npm run workshop:h4.",
	h4_complete: "Run npm run workshop:compare.",
	comparison_ready: "Review the adjacent comparisons. Ask for a limited claim and uncertainty, then run npm run workshop:finish.",
	complete: "The Harness Ladder Experiment Card is complete. Review it and reset H4 when ready.",
};

export function nextAction(stage: WorkshopStage): string { return NEXT[stage]; }

export function assertStage(session: WorkshopSession, expected: WorkshopStage): void {
	if (session.stage !== expected) throw new Error(`This command requires stage ${expected}; current stage is ${session.stage}. ${nextAction(session.stage)}`);
}

export function isWorkshopSession(value: unknown): value is WorkshopSession {
	if (!value || typeof value !== "object") return false;
	const session = value as Partial<WorkshopSession>;
	return session.schemaVersion === "agent-native-harness-ladder/v2"
		&& typeof session.ladderId === "string"
		&& typeof session.stage === "string"
		&& STAGES.includes(session.stage as WorkshopStage)
		&& typeof session.createdAt === "string"
		&& typeof session.updatedAt === "string"
		&& !!session.runs && typeof session.runs === "object";
}
