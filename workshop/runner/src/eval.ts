import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function runFixedEval(options: {
	worktree: string;
	taskId: string;
	runDir: string;
	timeoutMs: number;
}): Promise<{ exitCode: number | null; timedOut: boolean; reportPath: string }> {
	const evalDir = join(options.runDir, "eval");
	const reportPath = join(options.runDir, "evaluation-report.json");
	await mkdir(evalDir, { recursive: true });
	const result = await new Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string }>((resolve) => {
		let timedOut = false;
		const child = spawn("npm", ["run", "eval", "--", "--task", options.taskId, "--run-dir", options.runDir, "--report", reportPath], {
			cwd: options.worktree,
			env: { ...process.env, CI: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += String(chunk)));
		child.stderr.on("data", (chunk) => (stderr += String(chunk)));
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
		}, options.timeoutMs);
		child.on("close", (exitCode) => {
			clearTimeout(timer);
			resolve({ exitCode, timedOut, stdout, stderr });
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolve({ exitCode: null, timedOut: false, stdout, stderr: `${stderr}${error.message}` });
		});
	});
	await writeFile(join(evalDir, "stdout.txt"), result.stdout);
	await writeFile(join(evalDir, "stderr.txt"), result.stderr);
	await writeFile(join(evalDir, "invocation.json"), JSON.stringify({ command: "npm run eval", ...result }, null, 2));

	try {
		await readFile(reportPath, "utf8");
	} catch {
		await writeFile(
			reportPath,
			JSON.stringify(
				{
					schema_version: "workshop-eval/v1",
					completion_status: "EVALUATOR_ERROR",
					hard_gates: { evaluator_invocation: result.exitCode === 0 ? "ERROR" : "FAIL" },
					evaluator: { command: "npm run eval", exit_code: result.exitCode, timed_out: result.timedOut },
				},
				null,
				2,
			),
		);
	}
	return { exitCode: result.exitCode, timedOut: result.timedOut, reportPath };
}
