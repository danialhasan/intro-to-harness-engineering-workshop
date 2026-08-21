import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface PreparationResult {
	status: "INSTALLED" | "NOT_REQUIRED" | "FAILED" | "TIMEOUT";
	exitCode: number | null;
	durationMs: number;
}

/** Install the copied fixture before Pi sees it. This is runner work, never a model task. */
export async function prepareFixture(worktree: string, runDir: string, timeoutMs: number): Promise<PreparationResult> {
	const setupDir = join(runDir, "setup");
	await mkdir(setupDir, { recursive: true });
	try {
		await access(join(worktree, "package-lock.json"));
	} catch {
		const result: PreparationResult = { status: "NOT_REQUIRED", exitCode: 0, durationMs: 0 };
		await writeFile(join(setupDir, "npm-ci.json"), JSON.stringify({ command: null, ...result }, null, 2));
		return result;
	}

	const startedAt = performance.now();
	const execution = await new Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string }>((resolve) => {
		let timedOut = false;
		const child = spawn("npm", ["ci", "--ignore-scripts"], {
			cwd: worktree,
			env: { ...process.env, CI: "1", npm_config_audit: "false", npm_config_fund: "false" },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += String(chunk)));
		child.stderr.on("data", (chunk) => (stderr += String(chunk)));
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
		}, timeoutMs);
		child.on("close", (exitCode) => {
			clearTimeout(timer);
			resolve({ exitCode, timedOut, stdout, stderr });
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolve({ exitCode: null, timedOut, stdout, stderr: `${stderr}${error.message}` });
		});
	});
	const durationMs = Math.round(performance.now() - startedAt);
	const result: PreparationResult = {
		status: execution.timedOut ? "TIMEOUT" : execution.exitCode === 0 ? "INSTALLED" : "FAILED",
		exitCode: execution.exitCode,
		durationMs,
	};
	await writeFile(join(setupDir, "npm-ci.stdout.txt"), execution.stdout);
	await writeFile(join(setupDir, "npm-ci.stderr.txt"), execution.stderr);
	await writeFile(join(setupDir, "npm-ci.json"), JSON.stringify({ command: "npm ci --ignore-scripts", ...result }, null, 2));
	return result;
}
