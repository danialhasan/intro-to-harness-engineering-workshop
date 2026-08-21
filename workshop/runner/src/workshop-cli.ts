import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectTrace, traceEvidence } from "./prime-inspect.js";
import { compareAdjacent } from "./prime-compare.js";
import { validateParticipantPolicy } from "./validate-policy.js";
import { assertStage, isWorkshopSession, nextAction, VARIANTS, type RunRecord, type Variant, type WorkshopSession } from "./workshop-state.js";

const SESSION_FILE = resolve(".workshop-session.json");
const PUBLIC_TEXT_MAX = 500;
const REFERENCE_VARIANTS: Variant[] = ["h0", "h1", "h2", "h3"];
const CLASSIFICATIONS = new Set(["missing-context", "missing-verification", "unsafe-action", "poor-stopping", "inefficient-path", "no-clear-weakness"]);
const MECHANISMS: Record<Variant, string> = {
	h0: "Minimal fixed policy",
	h1: "H0 + read the task and API contract before editing",
	h2: "H1 + run the visible test before editing",
	h3: "H2 + run the full release check after the final edit",
	h4: "H3 + the participant-selected mechanism",
};

function option(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}
function hasFlag(name: string): boolean { return process.argv.includes(`--${name}`); }
function required(name: string): string { const found = option(name)?.trim(); if (!found) throw new Error(`--${name} is required`); return found; }

export function publicText(value: string, label: string): string {
	const text = value.trim();
	if (text.length < 8 || text.length > PUBLIC_TEXT_MAX) throw new Error(`${label} must contain 8 to ${PUBLIC_TEXT_MAX} characters.`);
	const forbidden = [/(?:^|\s)\/[A-Za-z0-9._-]+(?:\/\S*)?/, /[A-Za-z]:\\/, /\b(?:sk|ghp|github_pat)-[A-Za-z0-9_-]{12,}\b/i, /\bAKIA[A-Z0-9]{12,}\b/, /\bBearer\s+[A-Za-z0-9._-]+/i, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, /https?:\/\//i];
	if (forbidden.some((pattern) => pattern.test(text))) throw new Error(`${label} appears to contain private data, a credential, an email address, a URL, or an absolute local path.`);
	return text.replaceAll("\r", " ").replaceAll("\n", " ");
}

export function parseSafeAuthResult(output: string): { status?: string; authType?: string; [key: string]: unknown } {
	for (const line of output.trim().split("\n").reverse()) {
		try { const parsed = JSON.parse(line) as { status?: string; authType?: string }; if (parsed.status || parsed.authType) return parsed; } catch { /* Ignore package-manager text. */ }
	}
	return {};
}

async function exists(path: string): Promise<boolean> { try { await access(path, constants.F_OK); return true; } catch { return false; } }
async function readSession(): Promise<WorkshopSession> {
	if (!await exists(SESSION_FILE)) throw new Error("No workshop session exists. Run npm run workshop:start.");
	const parsed = JSON.parse(await readFile(SESSION_FILE, "utf8")) as unknown;
	if (!isWorkshopSession(parsed)) throw new Error("The workshop session file is invalid. Preserve it before explicit recovery.");
	return parsed;
}
async function saveSession(session: WorkshopSession): Promise<void> {
	session.updatedAt = new Date().toISOString();
	const temporary = `${SESSION_FILE}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
	await rename(temporary, SESSION_FILE);
}

function printStatus(session: WorkshopSession): void {
	console.log(`Workshop ladder: ${session.ladderId}`);
	console.log(`Stage: ${session.stage}`);
	for (const variant of VARIANTS) if (session.runs[variant]) console.log(`${variant.toUpperCase()}: ${session.runs[variant]?.completionStatus}`);
	if (session.cardFile) console.log(`Experiment card: ${session.cardFile}`);
	console.log(`Next: ${nextAction(session.stage)}`);
}

async function run(command: string, args: string[], label: string): Promise<string> {
	console.log(`\n[${label}] ${command} ${args.join(" ")}`);
	return new Promise<string>((resolveRun, reject) => {
		const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: ["inherit", "pipe", "pipe"] });
		let output = "";
		const capture = (chunk: Buffer): void => { const text = chunk.toString("utf8"); output += text; process.stdout.write(text); };
		child.stdout.on("data", capture); child.stderr.on("data", capture);
		child.once("error", reject);
		child.once("exit", (code, signal) => signal ? reject(new Error(`${label} ended by ${signal}.`)) : code === 0 ? resolveRun(output) : reject(new Error(`${label} failed with exit code ${code ?? 1}.`)));
	});
}

async function start(): Promise<void> {
	if (await exists(SESSION_FILE)) {
		const existing = await readSession();
		if (!hasFlag("new")) { printStatus(existing); return; }
		if (existing.stage !== "complete" && !hasFlag("discard-incomplete")) throw new Error("The current ladder is incomplete. Resume it, or add --discard-incomplete only after the participant approves discarding it.");
		await mkdir(resolve("backups"), { recursive: true });
		const stamp = Date.now();
		await copyFile(SESSION_FILE, resolve("backups", `session-${existing.ladderId}-${stamp}.json`));
		await copyFile(resolve("policies/h4.md"), resolve("backups", `h4-${existing.ladderId}-${stamp}.md`));
		await copyFile(resolve("policies/h4.default.md"), resolve("policies/h4.md"));
	}
	await validateParticipantPolicy(false);
	const now = new Date().toISOString();
	const ladderId = `ladder-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 6)}`;
	const session: WorkshopSession = { schemaVersion: "agent-native-harness-ladder/v2", ladderId, stage: "started", createdAt: now, updatedAt: now, runs: {} };
	await saveSession(session);
	console.log("Started a local, resumable H0-H4 workshop ladder. No personal data was recorded.");
	printStatus(session);
}

async function doctor(): Promise<void> {
	const session = await readSession(); assertStage(session, "started");
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (major < 22 || (major === 22 && minor < 19)) throw new Error(`Node ${process.versions.node} is too old. Use Node 22.19.0 or later.`);
	console.log(`Node ${process.versions.node}: PASS`);
	await run("uvx", ["--version"], "uvx");
	await run("npm", ["run", "check:types"], "Type check");
	await run("npm", ["run", "check:h4"], "H4 boundary");
	await run("npm", ["run", "prime:sync"], "Pinned Prime sync");
	await run("uvx", ["--from", "uv==0.11.1", "uv", "run", "--project", "prime", "eval", "@", "configs/h0.toml", "--dry-run"], "Prime dry run");
	let auth = "";
	try { auth = await run("npx", ["--no-install", "pi", "auth", "check", "--provider", "openai-codex", "--model", "gpt-5.5", "--json"], "Safe OpenAI OAuth check"); }
	catch { throw new Error("AUTH_REQUIRED: OpenAI Codex OAuth is not ready. Run npx --no-install pi, enter /login, choose OpenAI Codex, complete the private browser sign-in, exit Pi, and rerun npm run workshop:doctor. Never print or paste a token."); }
	const authResult = parseSafeAuthResult(auth);
	if (authResult.status !== "ready" || authResult.authType !== "oauth") throw new Error("AUTH_REQUIRED: the safe check did not confirm ready OAuth. Complete the private Pi /login handoff, then rerun this command.");
	session.stage = "ready"; await saveSession(session);
	console.log("\nPreflight complete. Prime upload remains disabled. No Prime account or API key is required."); printStatus(session);
}

async function runDirectories(ladderId: string, variant: Variant): Promise<Set<string>> {
	const root = resolve("runs", ladderId, variant); if (!await exists(root)) return new Set();
	return new Set((await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
}
async function completedDirectories(ladderId: string, variant: Variant): Promise<string[]> {
	const completed: string[] = [];
	for (const name of await runDirectories(ladderId, variant)) if (await exists(resolve("runs", ladderId, variant, name, "workshop-run.json"))) completed.push(name);
	return completed;
}
async function recordRun(session: WorkshopSession, variant: Variant, runId: string): Promise<RunRecord> {
	const runDir = resolve("runs", session.ladderId, variant, runId);
	const manifest = JSON.parse(await readFile(resolve(runDir, "workshop-run.json"), "utf8")) as Record<string, unknown>;
	const summaryFile = resolve(runDir, "safe-trace-summary.txt");
	await writeFile(summaryFile, await inspectTrace(runDir));
	const evidence = await traceEvidence(runDir);
	return { variant, runId, runDir, completionStatus: String(manifest.completion_status ?? "UNKNOWN"), summaryFile, evidence: { readsContractBeforeFirstEdit: evidence.readsContractBeforeFirstEdit, runsTestBeforeFirstEdit: evidence.runsTestBeforeFirstEdit, verifiesAfterFinalEdit: evidence.verifiesAfterFinalEdit, actionCount: evidence.actions.length, turns: evidence.turns } };
}
async function executeVariant(session: WorkshopSession, variant: Variant): Promise<RunRecord> {
	if (session.runs[variant]) { console.log(`Skipping completed ${variant.toUpperCase()}; no model call repeated.`); return session.runs[variant] as RunRecord; }
	const recovered = await completedDirectories(session.ladderId, variant);
	if (recovered.length === 1) { console.log(`Recovering completed ${variant.toUpperCase()} without another model call.`); return recordRun(session, variant, recovered[0]); }
	if (recovered.length > 1) throw new Error(`Found ${recovered.length} unclaimed ${variant.toUpperCase()} runs. Preserve them; the conductor will not guess.`);
	const before = await runDirectories(session.ladderId, variant);
	await run("npx", ["--no-install", "tsx", "src/prime-run.ts", variant, "--comparison", session.ladderId], `Prime ${variant.toUpperCase()} run`);
	const created = [...await runDirectories(session.ladderId, variant)].filter((name) => !before.has(name));
	if (created.length !== 1) throw new Error(`Expected one new ${variant.toUpperCase()} run directory; found ${created.length}.`);
	return recordRun(session, variant, created[0]);
}

function yes(value: boolean): string { return value ? "YES" : "no"; }
async function reward(record: RunRecord): Promise<unknown> { const manifest = JSON.parse(await readFile(resolve(record.runDir, "workshop-run.json"), "utf8")) as Record<string, unknown>; return manifest.reward ?? {}; }
async function ladderTable(session: WorkshopSession, variants: Variant[]): Promise<string> {
	const rows = ["| Variant | Added mechanism | Contract first | Test before edit | Verify after edit | Status | Reward | Actions | Turns |", "| --- | --- | --- | --- | --- | --- | --- | ---: | ---: |"];
	for (const variant of variants) {
		const record = session.runs[variant]; if (!record) continue;
		rows.push(`| ${variant.toUpperCase()} | ${MECHANISMS[variant]} | ${yes(record.evidence.readsContractBeforeFirstEdit)} | ${yes(record.evidence.runsTestBeforeFirstEdit)} | ${yes(record.evidence.verifiesAfterFinalEdit)} | ${record.completionStatus} | \`${JSON.stringify(await reward(record))}\` | ${record.evidence.actionCount} | ${record.evidence.turns} |`);
	}
	return rows.join("\n");
}

async function ladder(): Promise<void> {
	const session = await readSession(); assertStage(session, "ready");
	const throughOption = option("through");
	if (throughOption && !REFERENCE_VARIANTS.includes(throughOption as Variant)) throw new Error("--through must be h0, h1, h2, or h3");
	for (const variant of REFERENCE_VARIANTS) {
		session.runs[variant] = await executeVariant(session, variant); await saveSession(session);
		console.log(`\nSafe ${variant.toUpperCase()} summary: ${session.runs[variant]?.summaryFile}`); console.log(await readFile(session.runs[variant]?.summaryFile ?? "", "utf8"));
		if (throughOption === variant) { console.log(`Stopped cleanly after ${variant.toUpperCase()}. Run npm run workshop:ladder to resume; completed variants will be skipped.`); printStatus(session); return; }
	}
	session.stage = "reference_complete"; await saveSession(session);
	const report = `# H0-H3 Reference Ladder\n\n${await ladderTable(session, REFERENCE_VARIANTS)}\n\nThese are observed trajectories from one run per variant. A YES means the declared behavior appeared in the sanitized action order. It does not prove causality or general superiority.\n`;
	const reportFile = resolve("runs", session.ladderId, "REFERENCE_LADDER.md"); await writeFile(reportFile, report);
	console.log(`\nReference ladder: ${reportFile}\n${report}`);
	console.log("HUMAN DECISION REQUIRED: choose one additional H4 mechanism using the reference evidence."); printStatus(session);
}

async function recordDecision(): Promise<void> {
	const session = await readSession(); assertStage(session, "reference_complete");
	const classification = required("classification"); if (!CLASSIFICATIONS.has(classification)) throw new Error(`--classification must be one of: ${[...CLASSIFICATIONS].join(", ")}`);
	const evidence = publicText(required("evidence"), "Evidence"); const mechanism = publicText(required("mechanism"), "Mechanism");
	const source = option("decision-source") ?? "participant"; if (source !== "participant" && source !== "author-simulation") throw new Error("--decision-source must be participant or author-simulation");
	session.decision = { classification, evidence, mechanism, source };
	await writeFile(resolve("runs", session.ladderId, "decision.md"), `# H4 decision\n\n- Source: ${source}\n- Classification: ${classification}\n- Observable evidence: ${evidence}\n- Selected mechanism: ${mechanism}\n\n${source === "participant" ? "The participant selected this mechanism after reviewing the H0-H3 ladder." : "This is an author simulation, not an attendee decision."}\n`);
	session.stage = "decision_recorded"; await saveSession(session); printStatus(session);
}

async function h4(): Promise<void> {
	const session = await readSession(); assertStage(session, "decision_recorded"); await validateParticipantPolicy(true);
	session.runs.h4 = await executeVariant(session, "h4"); session.stage = "h4_complete"; await saveSession(session);
	console.log(`\nSafe H4 summary: ${session.runs.h4.summaryFile}`); console.log(await readFile(session.runs.h4.summaryFile, "utf8")); printStatus(session);
}

async function compare(): Promise<void> {
	const session = await readSession(); assertStage(session, "h4_complete");
	const adjacent: Array<[Variant, Variant]> = [["h0", "h1"], ["h1", "h2"], ["h2", "h3"], ["h3", "h4"]];
	const results: string[] = [];
	for (const [left, right] of adjacent) {
		const leftRun = session.runs[left]; const rightRun = session.runs[right]; if (!leftRun || !rightRun) throw new Error(`Missing ${left} or ${right} run.`);
		const result = await compareAdjacent(session.ladderId, left, leftRun.runId, right, rightRun.runId);
		if (!result.valid) throw new Error(`${left.toUpperCase()} to ${right.toUpperCase()} is not a valid controlled comparison.`);
		results.push(`- ${left.toUpperCase()} → ${right.toUpperCase()}: VALID; ${result.fixedControlCount} fixed controls MATCH; policy DIFFERENT`);
	}
	const report = `# Harness Ladder Comparison\n\n${await ladderTable(session, [...VARIANTS])}\n\n## Adjacent control checks\n\n${results.join("\n")}\n\n## Interpretation boundary\n\nThis ladder reports observed action order and deterministic scorer outcomes for one task and one run per policy. It can show progression, regression, or no visible change. It does not prove that any policy or harness is generally better.\n`;
	await writeFile(resolve("runs", session.ladderId, "LADDER_COMPARISON.md"), report);
	session.stage = "comparison_ready"; await saveSession(session); console.log(report);
	console.log("HUMAN DECISION REQUIRED: approve one limited claim and one remaining uncertainty."); printStatus(session);
}

export function buildExperimentCard(input: { ladderId: string; table: string; decision: NonNullable<WorkshopSession["decision"]>; claim: string; uncertainty: string; fixedControlCount: number }): string {
	return `# Harness Ladder Experiment Card\n\n## Experiment\n\n- Ladder: \`${input.ladderId}\`\n- Taskset: \`retry-http-v1\`\n- Policies: cumulative H0 through participant-created H4\n- Controlled difference: one declared policy mechanism per adjacent step\n- Fixed controls: ${input.fixedControlCount} rows matched in every adjacent comparison\n- Prime upload: disabled\n\n## Results\n\n${input.table}\n\n## ${input.decision.source === "participant" ? "Participant" : "Author-simulation"} H4 decision\n\n- Source: ${input.decision.source}\n- Classification: ${input.decision.classification}\n- Observable evidence: ${input.decision.evidence}\n- Selected mechanism: ${input.decision.mechanism}\n\n## Interpretation\n\n- Limited claim: ${input.claim}\n- Remaining uncertainty: ${input.uncertainty}\n\n## Evidence boundary\n\nThis ladder shows observed trajectory and deterministic scorer outcomes for one task and one run per policy. It does not prove that any harness, policy, agent, or model is generally better. Raw traces and credentials remain private local data. An author simulation is not evidence that an attendee completed the workshop.\n`;
}

async function finish(): Promise<void> {
	const session = await readSession(); assertStage(session, "comparison_ready"); if (!session.decision) throw new Error("The H4 decision is missing.");
	const claim = publicText(required("claim"), "Claim"); const uncertainty = publicText(required("uncertainty"), "Uncertainty");
	const cardFile = resolve("runs", session.ladderId, "HARNESS_LADDER_EXPERIMENT_CARD.md");
	await writeFile(cardFile, buildExperimentCard({ ladderId: session.ladderId, table: await ladderTable(session, [...VARIANTS]), decision: session.decision, claim, uncertainty, fixedControlCount: 24 }));
	session.cardFile = cardFile; session.stage = "complete"; await saveSession(session); console.log(`Experiment card complete: ${cardFile}`); printStatus(session);
}

async function status(): Promise<void> { printStatus(await readSession()); }
async function main(): Promise<void> {
	const command = process.argv[2];
	if (command === "start") return start(); if (command === "doctor") return doctor(); if (command === "status") return status(); if (command === "ladder") return ladder();
	if (command === "record-decision") return recordDecision(); if (command === "h4") return h4(); if (command === "compare") return compare(); if (command === "finish") return finish();
	throw new Error("Command must be start, doctor, status, ladder, record-decision, h4, compare, or finish.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
