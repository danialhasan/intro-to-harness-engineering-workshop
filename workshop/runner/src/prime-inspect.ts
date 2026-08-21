import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type JsonObject = Record<string, any>;

function option(name: string): string {
	const index = process.argv.indexOf(`--${name}`);
	const found = index >= 0 ? process.argv[index + 1] : undefined;
	if (!found) throw new Error(`--${name} is required`);
	return found;
}

export function sanitizeFileTarget(input: unknown): string {
	if (typeof input !== "string" || !input.trim()) return "<file>";
	const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "");
	const publicPart = normalized.match(/(?:^|\/)((?:docs|src|test|verifier|reference|starter)\/[^\s]+|TASK\.md|README\.md|package\.json)$/)?.[1];
	if (publicPart) return publicPart.slice(0, 160);
	if (isAbsolute(normalized)) return "<absolute-path>";
	return normalized.slice(0, 160);
}

export function summarizeCommand(input: unknown): string {
	if (typeof input !== "string") return "shell command";
	const npm = input.match(/\bnpm\s+(test|ci|run\s+[A-Za-z0-9:_-]+)/)?.[0];
	if (npm) return npm;
	if (/\b(?:find|ls)\b/.test(input)) return "repository inventory";
	if (/\brg\b/.test(input)) return "repository search";
	const git = input.match(/\bgit\s+([A-Za-z0-9:_-]+)/)?.[1];
	if (git) return `git ${git}`;
	if (/\bpwd\b/.test(input)) return "current directory check";
	return "shell command";
}

function argumentsOf(call: JsonObject): JsonObject {
	if (call.arguments && typeof call.arguments === "object") return call.arguments;
	if (typeof call.arguments === "string") {
		try { return JSON.parse(call.arguments) as JsonObject; } catch { return {}; }
	}
	return {};
}

function action(call: JsonObject): string {
	const name = String(call.name ?? call.function?.name ?? "tool");
	const args = argumentsOf(call.function ?? call);
	if (name === "bash") return `${name}: ${summarizeCommand(args.command)}`;
	if (["read", "edit", "write"].includes(name)) return `${name}: ${sanitizeFileTarget(args.path)}`;
	return name;
}

export async function inspectTrace(runDir: string): Promise<string> {
	const lines = (await readFile(resolve(runDir, "traces.jsonl"), "utf8")).trim().split("\n").filter(Boolean);
	const episode = JSON.parse(lines.at(-1) ?? "{}") as JsonObject;
	const trace = (episode.traces?.[0] ?? episode) as JsonObject;
	const actions: string[] = [];
	for (const node of trace.nodes ?? []) {
		for (const call of node.message?.tool_calls ?? []) actions.push(action(call));
	}
	const task = trace.task?.data?.task_id ?? trace.task?.data?.name ?? "not recorded";
	const evaluation = trace.info?.evaluation?.completion_status ?? "not recorded";
	const output = [
		"Prime trace summary (tool arguments only; tool results and raw content omitted)",
		`task: ${task}`,
		`evaluation: ${evaluation}`,
		`stop condition: ${trace.stop_condition ?? "not recorded"}`,
		`rewards: ${JSON.stringify(trace.rewards ?? {})}`,
		`metrics: ${JSON.stringify(trace.metrics ?? {})}`,
		"observable actions:",
		...actions.map((value, index) => `${String(index + 1).padStart(2, "0")}. ${value}`),
	];
	return `${output.join("\n")}\n`;
}

async function main(): Promise<void> {
	process.stdout.write(await inspectTrace(option("run-dir")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	void main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
