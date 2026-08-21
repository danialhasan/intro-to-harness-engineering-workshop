import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectTrace } from "./prime-inspect.js";
import { validateParticipantPolicy } from "./validate-policy.js";
import { assertStage, isWorkshopSession, nextAction, type RunRecord, type WorkshopSession } from "./workshop-state.js";

const SESSION_FILE = resolve(".workshop-session.json");
const PUBLIC_TEXT_MAX = 500;
const CLASSIFICATIONS = new Set(["missing-context", "missing-verification", "unsafe-action", "poor-stopping", "no-clear-weakness"]);

function option(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

function required(name: string): string {
	const found = option(name)?.trim();
	if (!found) throw new Error(`--${name} is required`);
	return found;
}

export function publicText(value: string, label: string): string {
	const text = value.trim();
	if (text.length < 8 || text.length > PUBLIC_TEXT_MAX) throw new Error(`${label} must contain 8 to ${PUBLIC_TEXT_MAX} characters.`);
	const forbidden = [
		/(?:^|\s)\/[A-Za-z0-9._-]+(?:\/\S*)?/,
		/[A-Za-z]:\\/,
		/\b(?:sk|ghp|github_pat)-[A-Za-z0-9_-]{12,}\b/i,
		/\bAKIA[A-Z0-9]{12,}\b/,
		/\bBearer\s+[A-Za-z0-9._-]+/i,
		/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
		/https?:\/\//i,
	];
	if (forbidden.some((pattern) => pattern.test(text))) throw new Error(`${label} appears to contain private data, a credential, an email address, or an absolute local path.`);
	return text.replaceAll("\r", " ").replaceAll("\n", " ");
}

export function parseSafeAuthResult(output: string): { status?: string; authType?: string } {
	for (const line of output.trim().split("\n").reverse()) {
		try {
			const parsed = JSON.parse(line) as { status?: string; authType?: string };
			if (parsed.status || parsed.authType) return parsed;
		} catch { /* Ignore non-JSON package-manager output. */ }
	}
	return {};
}

async function exists(path: string): Promise<boolean> {
	try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function readSession(): Promise<WorkshopSession> {
	if (!await exists(SESSION_FILE)) throw new Error("No workshop session exists. Run npm run workshop:start.");
	const parsed = JSON.parse(await readFile(SESSION_FILE, "utf8")) as unknown;
	if (!isWorkshopSession(parsed)) throw new Error("The workshop session file is invalid. Preserve it, then start a new session with explicit recovery.");
	return parsed;
}

async function saveSession(session: WorkshopSession): Promise<void> {
	session.updatedAt = new Date().toISOString();
	const temporary = `${SESSION_FILE}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
	await rename(temporary, SESSION_FILE);
}

function printStatus(session: WorkshopSession): void {
	console.log(`Workshop pair: ${session.pairId}`);
	console.log(`Stage: ${session.stage}`);
	if (session.baseline) console.log(`Baseline: ${session.baseline.completionStatus}`);
	if (session.changed) console.log(`Changed: ${session.changed.completionStatus}`);
	if (session.cardFile) console.log(`Experiment card: ${session.cardFile}`);
	const next = session.stage === "comparison_ready" && session.decision?.source === "author-simulation"
		? "Write a limited author-validation claim and uncertainty, then run npm run workshop:finish. Do not attribute the decision to an attendee."
		: nextAction(session.stage);
	console.log(`Next: ${next}`);
}

async function run(command: string, args: string[], label: string): Promise<string> {
	console.log(`\n[${label}] ${command} ${args.join(" ")}`);
	return await new Promise<string>((resolveRun, reject) => {
		const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: ["inherit", "pipe", "pipe"] });
		let output = "";
		const capture = (chunk: Buffer): void => { const text = chunk.toString("utf8"); output += text; process.stdout.write(text); };
		child.stdout.on("data", capture);
		child.stderr.on("data", capture);
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) reject(new Error(`${label} ended by ${signal}.`));
			else if (code !== 0) reject(new Error(`${label} failed with exit code ${code ?? 1}.`));
			else resolveRun(output);
		});
	});
}

async function start(): Promise<void> {
	if (await exists(SESSION_FILE)) {
		const existing = await readSession();
		if (!hasFlag("new")) { printStatus(existing); return; }
		if (existing.stage !== "complete" && !hasFlag("discard-incomplete")) {
			throw new Error("The current workshop session is incomplete. Resume it, or add --discard-incomplete only after the participant approves discarding it.");
		}
		await mkdir(resolve("backups"), { recursive: true });
		const stamp = Date.now();
		await copyFile(SESSION_FILE, resolve("backups", `session-${existing.pairId}-${stamp}.json`));
		await copyFile(resolve("policies/participant.md"), resolve("backups", `participant-${existing.pairId}-${stamp}.md`));
		await copyFile(resolve("policies/participant.default.md"), resolve("policies/participant.md"));
	}
	await validateParticipantPolicy(false);
	const now = new Date().toISOString();
	const pairId = `pair-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 6)}`;
	const session: WorkshopSession = { schemaVersion: "agent-native-workshop/v1", pairId, stage: "started", createdAt: now, updatedAt: now };
	await saveSession(session);
	console.log("Started a local, resumable workshop session. No personal data was recorded.");
	printStatus(session);
}

async function doctor(): Promise<void> {
	const session = await readSession();
	assertStage(session, "started");
	const major = Number(process.versions.node.split(".")[0]);
	const minor = Number(process.versions.node.split(".")[1]);
	if (major < 22 || (major === 22 && minor < 19)) throw new Error(`Node ${process.versions.node} is too old. Use Node 22.19.0 or later.`);
	console.log(`Node ${process.versions.node}: PASS`);
	await run("uvx", ["--version"], "uvx");
	await run("npm", ["run", "check:types"], "Type check");
	await run("npm", ["run", "check:policy"], "Policy boundary");
	await run("npm", ["run", "prime:sync"], "Pinned Prime sync");
	await run("uvx", ["--from", "uv==0.11.1", "uv", "run", "--project", "prime", "eval", "@", "configs/baseline.toml", "--dry-run"], "Prime dry run");
	let auth = "";
	try {
		auth = await run("npx", ["--no-install", "pi", "auth", "check", "--provider", "openai-codex", "--model", "gpt-5.5", "--json"], "Safe OpenAI OAuth check");
	} catch {
		throw new Error("AUTH_REQUIRED: OpenAI Codex OAuth is not ready. Run npx --no-install pi, enter /login, choose OpenAI Codex, complete the private browser sign-in, exit Pi, and rerun npm run workshop:doctor. Never print or paste a token.");
	}
	const authResult = parseSafeAuthResult(auth);
	if (authResult.status !== "ready" || authResult.authType !== "oauth") {
		throw new Error("AUTH_REQUIRED: the safe check did not confirm ready OAuth. Complete the private Pi /login handoff, then rerun this command.");
	}
	session.stage = "ready";
	await saveSession(session);
	console.log("\nPreflight complete. Prime upload remains disabled. No Prime account or API key is required.");
	printStatus(session);
}

async function runDirectories(pairId: string, candidate: "baseline" | "changed"): Promise<Set<string>> {
	const root = resolve("runs", pairId, candidate);
	if (!await exists(root)) return new Set();
	return new Set((await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
}

async function completedRunDirectories(pairId: string, candidate: "baseline" | "changed"): Promise<string[]> {
	const completed: string[] = [];
	for (const name of await runDirectories(pairId, candidate)) {
		if (await exists(resolve("runs", pairId, candidate, name, "workshop-run.json"))) completed.push(name);
	}
	return completed;
}

async function recordRun(session: WorkshopSession, candidate: "baseline" | "changed", runId: string): Promise<RunRecord> {
	const runDir = resolve("runs", session.pairId, candidate, runId);
	const manifest = JSON.parse(await readFile(resolve(runDir, "workshop-run.json"), "utf8")) as Record<string, unknown>;
	const summaryFile = resolve(runDir, "safe-trace-summary.txt");
	await writeFile(summaryFile, await inspectTrace(runDir));
	return { runId, runDir, completionStatus: String(manifest.completion_status ?? "UNKNOWN"), summaryFile };
}

async function executeCandidate(session: WorkshopSession, candidate: "baseline" | "changed"): Promise<RunRecord> {
	const recovered = await completedRunDirectories(session.pairId, candidate);
	if (recovered.length === 1) {
		console.log(`Recovering the completed ${candidate} run without another model call.`);
		return recordRun(session, candidate, recovered[0]);
	}
	if (recovered.length > 1) throw new Error(`Found ${recovered.length} unclaimed completed ${candidate} runs. Preserve them and start a new pair; the conductor will not guess.`);
	const before = await runDirectories(session.pairId, candidate);
	await run("npx", ["--no-install", "tsx", "src/prime-run.ts", candidate, "--comparison", session.pairId], `Prime ${candidate} run`);
	const after = await runDirectories(session.pairId, candidate);
	const created = [...after].filter((name) => !before.has(name));
	if (created.length !== 1) throw new Error(`Expected one new ${candidate} run directory; found ${created.length}. Preserve the runs and inspect them before recovery.`);
	return recordRun(session, candidate, created[0]);
}

async function baseline(): Promise<void> {
	const session = await readSession();
	assertStage(session, "ready");
	session.baseline = await executeCandidate(session, "baseline");
	session.stage = "baseline_complete";
	await saveSession(session);
	console.log(`\nSafe baseline summary: ${session.baseline.summaryFile}`);
	console.log(await readFile(session.baseline.summaryFile, "utf8"));
	console.log("HUMAN DECISION REQUIRED: the operator must present evidence-linked options and wait for the participant to choose the mechanism.");
	printStatus(session);
}

async function recordDecision(): Promise<void> {
	const session = await readSession();
	assertStage(session, "baseline_complete");
	const classification = required("classification");
	if (!CLASSIFICATIONS.has(classification)) throw new Error(`--classification must be one of: ${[...CLASSIFICATIONS].join(", ")}`);
	const evidence = publicText(required("evidence"), "Evidence");
	const mechanism = publicText(required("mechanism"), "Mechanism");
	const source = option("decision-source") ?? "participant";
	if (source !== "participant" && source !== "author-simulation") throw new Error("--decision-source must be participant or author-simulation");
	session.decision = { classification, evidence, mechanism, source };
	const decisionFile = resolve("runs", session.pairId, "decision.md");
	const attribution = source === "participant"
		? "The participant selected this mechanism after reviewing the sanitized baseline trace."
		: "This mechanism was selected for an author simulation. It is validation evidence, not an attendee decision.";
	await writeFile(decisionFile, `# Workshop decision\n\n- Source: ${source}\n- Classification: ${classification}\n- Observable evidence: ${evidence}\n- Selected mechanism: ${mechanism}\n\n${attribution}\n`);
	session.stage = "decision_recorded";
	await saveSession(session);
	console.log(`Decision recorded: ${decisionFile}`);
	printStatus(session);
}

async function changed(): Promise<void> {
	const session = await readSession();
	assertStage(session, "decision_recorded");
	await validateParticipantPolicy(true);
	session.changed = await executeCandidate(session, "changed");
	session.stage = "changed_complete";
	await saveSession(session);
	console.log(`\nSafe changed summary: ${session.changed.summaryFile}`);
	console.log(await readFile(session.changed.summaryFile, "utf8"));
	printStatus(session);
}

async function compare(): Promise<void> {
	const session = await readSession();
	assertStage(session, "changed_complete");
	if (!session.baseline || !session.changed) throw new Error("Both stored run records are required.");
	await run("npx", ["--no-install", "tsx", "src/prime-compare.ts", "--comparison", session.pairId, "--baseline-run-id", session.baseline.runId, "--changed-run-id", session.changed.runId], "Fixed-control comparison");
	const ledger = JSON.parse(await readFile(resolve("runs", session.pairId, "fixed-control-ledger.json"), "utf8")) as { valid?: boolean };
	if (ledger.valid !== true) throw new Error("The fixed-control comparison is invalid. Preserve the pair and inspect the ledger.");
	session.stage = "comparison_ready";
	await saveSession(session);
	console.log(await readFile(resolve("runs", session.pairId, "comparison-summary.md"), "utf8"));
	if (session.decision?.source === "author-simulation") {
		console.log("AUTHOR SIMULATION REVIEW REQUIRED: write a limited validation claim and uncertainty. Do not present either as an attendee decision.");
	} else {
		console.log("HUMAN DECISION REQUIRED: the operator must challenge overclaiming and wait for the participant to approve a limited claim and one uncertainty.");
	}
	printStatus(session);
}

function fenced(value: string): string {
	return value.replaceAll("```", "` ` `");
}

export function buildExperimentCard(input: {
	pairId: string;
	fixedControlCount: number;
	decision: { classification: string; evidence: string; mechanism: string; source: "participant" | "author-simulation" };
	baselineStatus: string;
	baselineReward: unknown;
	changedStatus: string;
	changedReward: unknown;
	baselineSummary: string;
	changedSummary: string;
	claim: string;
	uncertainty: string;
}): string {
	const decisionHeading = input.decision.source === "participant" ? "Participant decision" : "Author-simulation decision";
	return `# Harness Experiment Card\n\n## Experiment\n\n- Pair: \`${input.pairId}\`\n- Taskset: \`retry-http-v1\`\n- Controlled difference: participant policy text only\n- Fixed controls: ${input.fixedControlCount} rows matched\n- Prime upload: disabled\n\n## ${decisionHeading}\n\n- Source: ${input.decision.source}\n- Classification: ${input.decision.classification}\n- Observable evidence: ${input.decision.evidence}\n- Selected mechanism: ${input.decision.mechanism}\n\n## Results\n\n- Baseline: ${input.baselineStatus}; rewards ${fenced(JSON.stringify(input.baselineReward ?? {}))}\n- Changed: ${input.changedStatus}; rewards ${fenced(JSON.stringify(input.changedReward ?? {}))}\n\n## Sanitized trajectory summaries\n\n### Baseline\n\n\`\`\`text\n${fenced(input.baselineSummary.trim())}\n\`\`\`\n\n### Changed\n\n\`\`\`text\n${fenced(input.changedSummary.trim())}\n\`\`\`\n\n## Interpretation\n\n- Limited claim: ${input.claim}\n- Remaining uncertainty: ${input.uncertainty}\n\n## Evidence boundary\n\nThis controlled pair shows observed trajectory and deterministic scorer outcomes for one task and two runs. It does not prove that either harness, policy, agent, or model is generally better. Raw traces remain private local data. An author simulation is not evidence that an attendee completed the workshop.\n`;
}

async function finish(): Promise<void> {
	const session = await readSession();
	assertStage(session, "comparison_ready");
	if (!session.baseline || !session.changed || !session.decision) throw new Error("The baseline, decision, and changed run records are required.");
	const claim = publicText(required("claim"), "Claim");
	const uncertainty = publicText(required("uncertainty"), "Uncertainty");
	const ledger = JSON.parse(await readFile(resolve("runs", session.pairId, "fixed-control-ledger.json"), "utf8")) as { valid?: boolean; rows?: unknown[] };
	if (ledger.valid !== true) throw new Error("Cannot finish an invalid comparison.");
	const baselineManifest = JSON.parse(await readFile(resolve(session.baseline.runDir, "workshop-run.json"), "utf8")) as Record<string, unknown>;
	const changedManifest = JSON.parse(await readFile(resolve(session.changed.runDir, "workshop-run.json"), "utf8")) as Record<string, unknown>;
	const baselineSummary = await readFile(session.baseline.summaryFile, "utf8");
	const changedSummary = await readFile(session.changed.summaryFile, "utf8");
	const cardFile = resolve("runs", session.pairId, "HARNESS_EXPERIMENT_CARD.md");
	const card = buildExperimentCard({
		pairId: session.pairId,
		fixedControlCount: ledger.rows?.length ?? 0,
		decision: session.decision,
		baselineStatus: String(baselineManifest.completion_status ?? "UNKNOWN"),
		baselineReward: baselineManifest.reward,
		changedStatus: String(changedManifest.completion_status ?? "UNKNOWN"),
		changedReward: changedManifest.reward,
		baselineSummary,
		changedSummary,
		claim,
		uncertainty,
	});
	await writeFile(cardFile, card);
	session.cardFile = cardFile;
	session.stage = "complete";
	await saveSession(session);
	console.log(`Experiment card complete: ${cardFile}`);
	printStatus(session);
}

async function status(): Promise<void> {
	printStatus(await readSession());
}

async function main(): Promise<void> {
	const command = process.argv[2];
	if (command === "start") return start();
	if (command === "doctor") return doctor();
	if (command === "status") return status();
	if (command === "baseline") return baseline();
	if (command === "record-decision") return recordDecision();
	if (command === "changed") return changed();
	if (command === "compare") return compare();
	if (command === "finish") return finish();
	throw new Error("Command must be start, doctor, status, baseline, record-decision, changed, compare, or finish.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	void main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
