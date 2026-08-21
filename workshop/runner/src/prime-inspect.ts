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
		try {
			const parsed = JSON.parse(call.arguments) as unknown;
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonObject;
		} catch {
			throw new Error("Prime trace contains malformed tool arguments; keep the run and report this error.");
		}
		throw new Error("Prime trace contains non-object tool arguments; keep the run and report this error.");
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

export type TraceEvidence = {
	actions: string[];
	turns: number;
	readsContractBeforeFirstEdit: boolean;
	runsTestBeforeFirstEdit: boolean;
	verifiesAfterFinalEdit: boolean;
};

function npmCommands(input: unknown): string[] {
	if (typeof input !== "string") return [];
	return [...input.matchAll(/\bnpm\s+(?:test|run\s+[A-Za-z0-9:_-]+)/g)].map((match) => match[0]);
}

export async function traceEvidence(runDir: string): Promise<TraceEvidence> {
	const lines = (await readFile(resolve(runDir, "traces.jsonl"), "utf8")).trim().split("\n").filter(Boolean);
	const episode = JSON.parse(lines.at(-1) ?? "{}") as JsonObject;
	const trace = (episode.traces?.[0] ?? episode) as JsonObject;
	const actions: string[] = [];
	let turns = 0;
	for (const node of trace.nodes ?? []) {
		const calls = node.message?.tool_calls ?? [];
		if (calls.length > 0 || node.message?.role === "assistant") turns += 1;
		for (const call of calls) {
			const name = String(call.name ?? call.function?.name ?? "tool");
			const args = argumentsOf(call.function ?? call);
			if (name === "bash") {
				const commands = npmCommands(args.command);
				actions.push(commands.length > 0 ? `bash: ${commands.join("; ")}` : action(call));
			} else actions.push(action(call));
		}
	}
	const firstEdit = actions.findIndex((value) => value.startsWith("edit:") || value.startsWith("write:"));
	let lastEdit = -1;
	for (let index = actions.length - 1; index >= 0; index -= 1) {
		if (actions[index].startsWith("edit:") || actions[index].startsWith("write:")) { lastEdit = index; break; }
	}
	const before = firstEdit < 0 ? [] : actions.slice(0, firstEdit);
	const after = lastEdit < 0 ? [] : actions.slice(lastEdit + 1);
	const has = (values: string[], pattern: RegExp): boolean => values.some((value) => pattern.test(value));
	return {
		actions,
		turns,
		readsContractBeforeFirstEdit: has(before, /read: TASK\.md$/) && has(before, /read: docs\/api-contract\.md$/),
		runsTestBeforeFirstEdit: has(before, /\bnpm test\b/),
		verifiesAfterFinalEdit: has(after, /\bnpm test\b/) && has(after, /\bnpm run check\b/) && has(after, /\bnpm run eval\b/),
	};
}

export async function inspectTrace(runDir: string): Promise<string> {
	const lines = (await readFile(resolve(runDir, "traces.jsonl"), "utf8")).trim().split("\n").filter(Boolean);
	const episode = JSON.parse(lines.at(-1) ?? "{}") as JsonObject;
	const trace = (episode.traces?.[0] ?? episode) as JsonObject;
	const actions = (await traceEvidence(runDir)).actions;
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
