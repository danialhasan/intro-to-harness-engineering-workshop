import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getModel } from "@earendil-works/pi-ai/compat";
import { createAgentSession, getAgentDir, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { runFixedEval } from "./eval.js";
import { createIsolatedResourceLoader, WORKSHOP_RESOURCE_ISOLATION } from "./isolation.js";
import { selectHarness } from "./participant-harness.js";
import { prepareFixture } from "./prepare.js";
import { TraceRecorder } from "./trace.js";
import type { CandidateId, RunnerOptions } from "./types.js";
import { createFreshWorktree, fileHash, treeHash } from "./worktree.js";

function parseArgs(argv: string[]): RunnerOptions {
	const values = new Map<string, string>();
	for (let index = 0; index < argv.length; index += 2) {
		const key = argv[index];
		const value = argv[index + 1];
		if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near ${key ?? "end of command"}.`);
		values.set(key.slice(2), value);
	}
	const candidate = (values.get("candidate") ?? "baseline") as CandidateId;
	if (candidate !== "baseline" && candidate !== "changed") throw new Error("--candidate must be baseline or changed.");
	const mode = values.get("mode") ?? "pi";
	if (mode !== "pi" && mode !== "fixture") throw new Error("--mode must be pi or fixture.");
	const fixture = values.get("fixture");
	const taskId = values.get("task");
	if (!fixture || !taskId) throw new Error("Usage: npm run run -- --fixture <directory> --task <task-id> [--candidate baseline|changed] [--mode pi|fixture]");
	const comparisonId = values.get("comparison") ?? `comparison-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const requestedRunId = values.get("run-id");
	if (requestedRunId && (!isSafeRunId(requestedRunId) || !requestedRunId.startsWith(`${comparisonId}-${candidate}-`))) {
		throw new Error("--run-id must be one safe path segment and begin with <comparison>-<candidate>-.");
	}
	return {
		fixture: resolve(fixture),
		taskId,
		candidate,
		mode,
		runRoot: resolve(values.get("run-root") ?? "runs"),
		comparisonId,
		runId: requestedRunId,
		modelProvider: values.get("provider") ?? "openai-codex",
		modelId: values.get("model") ?? "gpt-5.5",
		thinkingLevel: (values.get("thinking") ?? "medium") as RunnerOptions["thinkingLevel"],
		timeoutMs: Number(values.get("timeout-ms") ?? "420000"),
	};
}

async function taskPrompt(worktree: string, taskId: string): Promise<string> {
	try {
		return await readFile(join(worktree, "TASK.md"), "utf8");
	} catch (error) {
		throw new Error(`Task ${taskId} requires a root TASK.md in the fixture: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function runFixture(recorder: TraceRecorder): Promise<void> {
	await recorder.lifecycle("model_request", { mode: "fixture", note: "No model request was made." });
	await recorder.toolStart("fixture-read-task", "read", { path: "TASK.md" });
	await recorder.toolEnd("fixture-read-task", "read", { status: "fixture only" }, false);
	await recorder.lifecycle("model_response", { mode: "fixture", note: "Synthetic lifecycle event; no model reasoning was captured." });
}

class ModelTimeoutError extends Error {
	public constructor() {
		super("TIMEOUT: Pi prompt/idle sequence exceeded the declared model timeout.");
	}
}

async function runPi(options: RunnerOptions, worktree: string, prompt: string, recorder: TraceRecorder): Promise<void> {
	const harness = selectHarness(options.candidate);
	const modelRuntime = await ModelRuntime.create();
	const model = modelRuntime.getModel(options.modelProvider, options.modelId) ?? getModel(options.modelProvider as never, options.modelId);
	if (!model) throw new Error(`Pi cannot resolve ${options.modelProvider}/${options.modelId}. Use Pi /login or choose an installed model.`);
	const harnessRules = harness.buildContext({ taskId: options.taskId, taskPrompt: prompt, worktree });
	const resourceLoader = createIsolatedResourceLoader({ cwd: worktree, agentDir: getAgentDir(), harnessRules });
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd: worktree,
		model,
		modelRuntime,
		thinkingLevel: options.thinkingLevel,
		tools: harness.allowedTools(),
		resourceLoader,
		sessionManager: SessionManager.inMemory(worktree),
		settingsManager: SettingsManager.inMemory(),
	});
	try {
		let eventTail = Promise.resolve();
		const deadlineAt = performance.now() + options.timeoutMs;
		const runPiTurn = async (userMessage: string): Promise<void> => {
			const remainingMs = Math.max(0, Math.round(deadlineAt - performance.now()));
			if (remainingMs === 0) throw new ModelTimeoutError();
			let timer: NodeJS.Timeout | undefined;
			const work = session.prompt(userMessage).then(() => session.waitForIdle());
			try {
				await Promise.race([
					work,
					new Promise<never>((_resolve, reject) => {
						timer = setTimeout(() => reject(new ModelTimeoutError()), remainingMs);
					}),
				]);
			} catch (error) {
				if (error instanceof ModelTimeoutError) {
					await recorder.lifecycle("harness_decision", { decision: "abort", reason: "TIMEOUT" }, "runner");
					try {
						// Pi's public SDK documents abort() as waiting for idle.
						await session.abort();
						await eventTail;
					} catch (abortError) {
						await recorder.lifecycle("abort_error", { message: abortError instanceof Error ? abortError.message : String(abortError) }, "runner");
					}
				}
				throw error;
			} finally {
				if (timer) clearTimeout(timer);
			}
		};
		session.subscribe((event) => {
			eventTail = eventTail.then(async () => {
				if (event.type === "tool_execution_start") await recorder.toolStart(event.toolCallId, event.toolName, event.args);
				if (event.type === "tool_execution_end") await recorder.toolEnd(event.toolCallId, event.toolName, event.result, event.isError);
				if (["agent_start", "agent_end", "agent_settled", "turn_start", "turn_end"].includes(event.type)) {
					await recorder.lifecycle(event.type, { note: "Pi lifecycle event. Assistant hidden reasoning is not saved." });
				}
			});
		});
		await recorder.lifecycle("model_request", { provider: options.modelProvider, model: options.modelId, thinking_level: options.thinkingLevel });
		// The exact root TASK.md content is the single user message. Harness rules live only in the system override.
		await runPiTurn(prompt);
		await eventTail;
		const gate = harness.shouldVerify(recorder.summary());
		if (gate.continue && gate.followUp) {
			await recorder.lifecycle("harness_decision", { reason: gate.reason, decision: "continue_for_verification" });
			await runPiTurn(gate.followUp);
			await eventTail;
		}
		const stop = harness.shouldContinue(recorder.summary());
		await recorder.lifecycle("harness_decision", { reason: stop.reason, decision: stop.continue ? "continue" : "stop" });
	} finally {
		session.dispose();
	}
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const runId = options.runId ?? `${options.comparisonId}-${options.candidate}-${randomUUID().slice(0, 8)}`;
	// A run ID is a path segment. This prevents a later run from appending to an earlier trace.
	const runDir = resolve(options.runRoot, options.comparisonId, options.candidate, runId);
	const relativeRunDir = relative(options.runRoot, runDir);
	if (relativeRunDir.startsWith("..") || relativeRunDir === "") {
		throw new Error("Resolved run directory must remain inside --run-root.");
	}
	const worktree = join(runDir, "worktree");
	await mkdir(dirname(runDir), { recursive: true });
	await mkdir(runDir);
	await createFreshWorktree(options.fixture, worktree);
	const initialTreeHash = await treeHash(worktree);
	const prompt = await taskPrompt(worktree, options.taskId);
	const harness = selectHarness(options.candidate);
	const configurationFor = (candidate: CandidateId) => {
		const selected = selectHarness(candidate);
		return { candidate_id: candidate, system_rules: selected.buildContext({ taskId: options.taskId, taskPrompt: prompt, worktree }), allowed_tools: selected.allowedTools() };
	};
	const harnessConfiguration = configurationFor(options.candidate);
	const harnessConfigurationHashes = {
		baseline: createHash("sha256").update(JSON.stringify(configurationFor("baseline"))).digest("hex"),
		changed: createHash("sha256").update(JSON.stringify(configurationFor("changed"))).digest("hex"),
	};
	const runnerContractHash = await hashFiles(dirname(fileURLToPath(import.meta.url)), ["cli.ts", "eval.ts", "isolation.ts", "prepare.ts", "trace.ts", "types.ts", "worktree.ts"]);
	const evaluatorSource = await firstHash(worktree, ["verifier/evaluate.ts", "evaluator/eval.ts"]);
	const evaluatorConfig = await firstHash(worktree, ["package-lock.json", "package.json"]);
	const manifest = {
		schema_version: "workshop-comparison/v1",
		run_id: runId,
		comparison_id: options.comparisonId,
		candidate_id: options.candidate,
		mode: options.mode,
		task_id: options.taskId,
		fixture: options.fixture,
		initial_tree_sha256: initialTreeHash,
		task_prompt_sha256: createHash("sha256").update(prompt).digest("hex"),
		runner_contract_sha256: runnerContractHash,
		runner_package_lock_sha256: await hashOrUnknown(join(dirname(fileURLToPath(import.meta.url)), "..", "package-lock.json")),
		participant_harness_source_sha256: await fileHash(join(dirname(fileURLToPath(import.meta.url)), "participant-harness.ts")),
		harness_configuration_sha256: createHash("sha256").update(JSON.stringify(harnessConfiguration)).digest("hex"),
		harness_configuration_hashes: harnessConfigurationHashes,
		model: { provider: options.modelProvider, id: options.modelId, thinking_level: options.thinkingLevel },
		allowed_tools: harnessConfiguration.allowed_tools,
		evaluator_source: evaluatorSource.path,
		evaluator_source_sha256: evaluatorSource.sha256,
		evaluator_version: "PENDING_REPORT",
		evaluator_report_schema: "PENDING_REPORT",
		evaluator_config: evaluatorConfig.path,
		evaluator_config_sha256: evaluatorConfig.sha256,
		package_lock_sha256: await hashOrUnknown(join(worktree, "package-lock.json")),
		runtime_version: { node: process.version, pi_coding_agent: "0.84.2" },
		model_timeout_ms: options.timeoutMs,
		allowed_path_boundary: { path: worktree, enforcement: "SYSTEM_RULE_ONLY" },
		network_policy: { declared: "No external services", enforcement: "NOT_ENFORCED_BY_RUNTIME", caveat: "Pi bash can invoke network commands." },
		operator_protocol: "Log each post-run_started operator action; substantive task guidance invalidates an autonomous comparison.",
		sampling_seed: "UNKNOWN",
		resource_loader_isolation: WORKSHOP_RESOURCE_ISOLATION,
	};
	const recorder = new TraceRecorder(runDir, runId, options.candidate);
	await recorder.init();
	await recorder.lifecycle("workspace_snapshot", { initial_tree_sha256: initialTreeHash }, "runner");
	const preparation = await prepareFixture(worktree, runDir, options.timeoutMs);
	await recorder.lifecycle("fixture_prepared", { status: preparation.status, exit_code: preparation.exitCode, duration_ms: preparation.durationMs }, "runner");
	await writeFile(join(runDir, "comparison-manifest.json"), JSON.stringify(manifest, null, 2));
	let runnerError: string | undefined;
	let terminationStatus: "MODEL_STOPPED" | "TIMEOUT" | "SETUP_FAILED" | "RUNNER_ERROR" = "MODEL_STOPPED";
	try {
		if (preparation.status === "FAILED" || preparation.status === "TIMEOUT") {
			terminationStatus = "SETUP_FAILED";
			throw new Error(`Fixture preparation ${preparation.status}; Pi will not run against an unprepared worktree.`);
		}
		if (options.mode === "fixture") await runFixture(recorder);
		else await runPi(options, worktree, prompt, recorder);
	} catch (error) {
		runnerError = error instanceof Error ? error.message : String(error);
		terminationStatus = error instanceof ModelTimeoutError ? "TIMEOUT" : terminationStatus === "SETUP_FAILED" ? "SETUP_FAILED" : "RUNNER_ERROR";
		await recorder.lifecycle("runner_error", { message: runnerError });
	} finally {
		await recorder.stopped(terminationStatus);
	}
	await recorder.lifecycle("verifier_started", { command: "npm run eval", task_id: options.taskId }, "runner");
	const evaluation = await runFixedEval({ worktree, taskId: options.taskId, runDir, timeoutMs: options.timeoutMs });
	try {
		const report = JSON.parse(await readFile(evaluation.reportPath, "utf8")) as { evaluator_version?: unknown; schema?: unknown; schema_version?: unknown; hard_gates?: Record<string, unknown> | Array<{ id?: unknown; status?: unknown }>; completion_status?: unknown };
		manifest.evaluator_version = typeof report.evaluator_version === "string" ? report.evaluator_version : typeof report.schema_version === "string" ? report.schema_version : typeof report.schema === "string" ? report.schema : "UNKNOWN";
		manifest.evaluator_report_schema = typeof report.schema_version === "string" ? report.schema_version : typeof report.schema === "string" ? report.schema : "UNKNOWN";
		for (const [checkId, result] of normalizeHardGates(report.hard_gates)) {
			await recorder.lifecycle("verifier_check", { check_id: checkId, result }, "runner");
		}
		await recorder.lifecycle("verifier_finished", { exit_code: evaluation.exitCode, timed_out: evaluation.timedOut, completion_status: String(report.completion_status ?? "UNKNOWN") }, "runner");
	} catch (error) {
		manifest.evaluator_version = "UNKNOWN";
		manifest.evaluator_report_schema = "UNKNOWN";
		await recorder.lifecycle("verifier_finished", { exit_code: evaluation.exitCode, timed_out: evaluation.timedOut, completion_status: "EVALUATOR_ERROR", parse_error: String(error) }, "runner");
	}
	await writeFile(join(runDir, "comparison-manifest.json"), JSON.stringify(manifest, null, 2));
	const finalTreeHash = await treeHash(worktree);
	const artifactHashes = {
		raw_events_sha256: await fileHash(join(runDir, "raw-events.jsonl")),
		normalized_actions_sha256: await fileHash(join(runDir, "normalized-actions.jsonl")),
		evaluation_report_sha256: await fileHash(join(runDir, "evaluation-report.json")),
		final_tree_sha256: finalTreeHash,
	};
	await writeFile(
		join(runDir, "run.json"),
		JSON.stringify({ run_id: runId, termination_status: terminationStatus, runner_error: runnerError, initial_tree_sha256: initialTreeHash, final_tree_sha256: finalTreeHash, artifact_hashes: artifactHashes, preparation, evaluation }, null, 2),
	);
	console.log(JSON.stringify({ runId, runDir, runnerError: runnerError ?? null, evaluation }, null, 2));
	process.exitCode = runnerError ? 2 : evaluation.exitCode === 0 ? 0 : 1;
}

function normalizeHardGates(hardGates: Record<string, unknown> | Array<{ id?: unknown; status?: unknown }> | undefined): Array<[string, string]> {
	if (Array.isArray(hardGates)) return hardGates.map((gate, index) => [typeof gate.id === "string" ? gate.id : `gate-${index}`, String(gate.status ?? "UNKNOWN")]);
	return Object.entries(hardGates ?? {}).map(([checkId, result]) => [checkId, String(result)]);
}

function isSafeRunId(value: string): boolean {
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

async function firstHash(root: string, candidates: string[]): Promise<{ path: string; sha256: string }> {
	for (const candidate of candidates) {
		try {
			return { path: candidate, sha256: await fileHash(join(root, candidate)) };
		} catch {
			// Candidate evaluator layouts differ. Absence is an explicit UNKNOWN below.
		}
	}
	return { path: "UNKNOWN", sha256: "UNKNOWN" };
}

async function hashOrUnknown(path: string): Promise<string> {
	try {
		return await fileHash(path);
	} catch {
		return "UNKNOWN";
	}
}

async function hashFiles(root: string, files: string[]): Promise<string> {
	const hash = createHash("sha256");
	for (const file of files.sort()) {
		hash.update(`${file}\n`);
		hash.update(await readFile(join(root, file)));
	}
	return hash.digest("hex");
}

void main();
