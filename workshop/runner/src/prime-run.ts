import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { startOAuthProxy } from "./oauth-proxy.js";
import { validateParticipantPolicy } from "./validate-policy.js";

export const VARIANTS = ["h0", "h1", "h2", "h3", "h4"] as const;
export type Variant = (typeof VARIANTS)[number];

function option(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function safe(value: string, label: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`${label} must be one safe path segment.`);
	return value;
}

async function sha256(path: string): Promise<string> {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function treeSha256(root: string): Promise<string> {
	const hash = createHash("sha256");
	const visit = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if ([".git", "node_modules", "dist", "runs"].includes(entry.name)) continue;
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile()) { hash.update(`${relative(root, path)}\n`); hash.update(await readFile(path)); }
		}
	};
	await visit(root);
	return hash.digest("hex");
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; log: string }> {
	return await new Promise<{ code: number; log: string }>((resolveExit, reject) => {
		const child = spawn(command, args, { cwd: process.cwd(), env, stdio: ["inherit", "pipe", "pipe"] });
		let log = "";
		const capture = (chunk: Buffer): void => {
			const text = chunk.toString("utf8");
			log += text;
			const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
			for (const line of plain.split("\n")) if (/rollout (start|done)|results:/.test(line)) console.log(line.trim());
		};
		child.stdout.on("data", capture);
		child.stderr.on("data", capture);
		child.once("error", reject);
		child.once("exit", (code, signal) => signal ? reject(new Error(`Prime eval ended by ${signal}`)) : resolveExit({ code: code ?? 1, log }));
	});
}

async function main(): Promise<void> {
	const candidate = process.argv[2] as Variant;
	if (!VARIANTS.includes(candidate)) throw new Error("first argument must be h0, h1, h2, h3, or h4");
	const comparisonId = safe(option("comparison") ?? `pair-${new Date().toISOString().replace(/[:.]/g, "-")}`, "comparison id");
	if (candidate === "h4") await validateParticipantPolicy(true);
	const runId = `${comparisonId}-${candidate}-${randomUUID().slice(0, 8)}`;
	const outputDir = resolve("runs", comparisonId, candidate);
	const runDir = resolve(outputDir, runId);
	await mkdir(outputDir, { recursive: true });
	const proxyKey = randomUUID();
	const proxy = await startOAuthProxy(proxyKey);
	let exitCode = 1;
	let primeLog = "";
	try {
		const result = await run("uvx", ["--from", "uv==0.11.1", "uv", "run", "--project", "prime", "eval", "@", `configs/${candidate}.toml`, "--client.base-url", proxy.url, "--output-dir", outputDir, "--run.name", runId, "--run.dir", runId], { ...process.env, WORKSHOP_PROXY_KEY: proxyKey });
		exitCode = result.code;
		primeLog = result.log;
	} finally {
		await proxy.close();
	}
	await mkdir(runDir, { recursive: true });
	await writeFile(resolve(runDir, "prime-eval.log"), primeLog);
	const policy = `policies/${candidate}.md`;
	if (exitCode !== 0) throw new Error(`Prime eval failed with exit code ${exitCode}. Inspect ${runDir} and the terminal output.`);
	const lines = (await readFile(resolve(runDir, "traces.jsonl"), "utf8")).trim().split("\n").filter(Boolean);
	const episode = JSON.parse(lines.at(-1) ?? "{}") as { traces?: Array<Record<string, any>> };
	const trace = (episode.traces?.[0] ?? episode) as Record<string, any>;
	const evaluation = trace.info?.evaluation ?? null;
	if (trace.ok !== true || !evaluation) throw new Error(`Prime rollout did not reach deterministic scoring. Inspect ${runDir}/traces.jsonl.`);
	const config = JSON.parse(await readFile(resolve(runDir, "configs/eval.json"), "utf8")) as Record<string, any>;
	const fixedControls = {
		taskset: config.env?.taskset?.id,
		task: trace.task?.data?.task_id,
		fixture: trace.task?.data?.fixture_version,
		fixture_tree_sha256: await treeSha256(resolve("../candidates/retry-http")),
		model: config.model,
		compute_route: "Pi stored OAuth subscription",
		reasoning_effort: config.sampling?.reasoning_effort,
		sampling_max_tokens: config.sampling?.max_tokens,
		prime_build: trace.verifiers,
		pi_harness: config.env?.agent?.harness,
		runtime: config.env?.agent?.runtime,
		max_turns: config.env?.agent?.max_turns,
		max_output_tokens: config.env?.agent?.max_output_tokens,
		timeouts: config.env?.agent?.timeout,
		num_tasks: config.num_tasks,
		num_rollouts: config.num_rollouts,
		max_concurrent: config.max_concurrent,
		tools: (trace.tools ?? []).map((tool: Record<string, any>) => tool.name),
		client: { type: config.client?.type, route: "per-run localhost Pi OAuth adapter", api_key_var: config.client?.api_key_var },
		evaluator: evaluation.evaluator_version,
		evaluator_sha256: await sha256(resolve("../candidates/retry-http/verifier/evaluate.ts")),
		fixture_lock_sha256: await sha256(resolve("../candidates/retry-http/package-lock.json")),
		prime_lock_sha256: await sha256(resolve("prime/uv.lock")),
		prime_push: config.push,
	};
	await writeFile(resolve(runDir, "evaluation-report.json"), `${JSON.stringify(evaluation, null, 2)}\n`);
	await writeFile(resolve(runDir, "workshop-run.json"), `${JSON.stringify({ schema_version: "prime-workshop-run/v2", comparison_id: comparisonId, variant: candidate, run_id: runId, policy_sha256: await sha256(resolve(policy)), fixed_controls: fixedControls, prime_exit_code: exitCode, trace_id: trace.id ?? null, reward: trace.rewards ?? null, metrics: trace.metrics ?? null, completion_status: evaluation?.completion_status ?? "UNKNOWN" }, null, 2)}\n`);
	await new Promise<void>((done) => process.stdout.write(`${JSON.stringify({ runId, runDir, candidate, completionStatus: evaluation?.completion_status ?? "UNKNOWN", primeExitCode: exitCode }, null, 2)}\n`, () => done()));
	// ModelRuntime can retain a non-workshop Node handle after the final response.
	// All artifacts and stdout are complete here, so end this command explicitly.
	process.exit(exitCode);
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
