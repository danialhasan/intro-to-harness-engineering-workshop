import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ActionKind, CandidateId, Phase } from "./types.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface NormalizedAction {
	schema_version: "workshop-trace/v1";
	run_id: string;
	candidate_id: CandidateId;
	step: number;
	phase: Phase;
	action_kind: ActionKind;
	target: string;
	result: "OK" | "ERROR";
	started_monotonic_ms: number;
	ended_monotonic_ms: number;
	source_event_ids: string[];
	artifact_refs: Array<{ sha256: string; kind: "tool_args" | "tool_output" }>;
	classification_confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface PendingTool {
	eventId: string;
	toolName: string;
	argsHash: string;
	args: unknown;
	started: number;
}

export class TraceRecorder {
	private sequence = 0;
	private step = 0;
	private readonly startedAt = process.hrtime.bigint();
	private readonly pending = new Map<string, PendingTool>();
	private readonly actions: Array<Pick<NormalizedAction, "action_kind" | "phase" | "result">> = [];

	public constructor(
		private readonly runDir: string,
		private readonly runId: string,
		private readonly candidateId: CandidateId,
	) {}

	public async init(): Promise<void> {
		await mkdir(join(this.runDir, "artifacts"), { recursive: true });
		await this.raw("run_started", "runner", { source: "workshop-runner" });
	}

	public summary() {
		return {
			completedActions: this.actions.map((action) => ({
				actionKind: action.action_kind,
				phase: action.phase,
				result: action.result,
			})),
			verificationObserved: this.actions.some((action) => action.action_kind === "test" && action.result === "OK"),
		};
	}

	public async lifecycle(type: string, data: Record<string, Json> = {}, actor: "pi" | "runner" = "pi"): Promise<void> {
		await this.raw(type, actor, data);
	}

	public async toolStart(toolCallId: string, toolName: string, args: unknown): Promise<void> {
		const artifact = await this.saveArtifact("tool_args", args);
		const eventId = await this.raw("tool_call", "pi", {
			tool_call_id: toolCallId,
			tool_name: toolName,
			args_ref: artifact,
		});
		this.pending.set(toolCallId, { eventId, toolName, argsHash: artifact.sha256, args, started: this.elapsedMs() });
	}

	public async toolEnd(toolCallId: string, toolName: string, result: unknown, isError: boolean): Promise<void> {
		const pending = this.pending.get(toolCallId);
		const artifact = await this.saveArtifact("tool_output", result);
		const eventId = await this.raw("tool_result", "pi", {
			tool_call_id: toolCallId,
			tool_name: toolName,
			is_error: isError,
			result_ref: artifact,
		});
		const classified = classifyTool(toolName, pending?.args);
		const action: NormalizedAction = {
			schema_version: "workshop-trace/v1",
			run_id: this.runId,
			candidate_id: this.candidateId,
			step: ++this.step,
			phase: classified.phase,
			action_kind: classified.actionKind,
			target: targetFor(toolName, pending?.args),
			result: isError ? "ERROR" : "OK",
			started_monotonic_ms: pending?.started ?? this.elapsedMs(),
			ended_monotonic_ms: this.elapsedMs(),
			source_event_ids: pending ? [pending.eventId, eventId] : [eventId],
			artifact_refs: [
				...(pending ? [{ sha256: pending.argsHash, kind: "tool_args" as const }] : []),
				{ sha256: artifact.sha256, kind: "tool_output" },
			],
			classification_confidence: classified.confidence,
		};
		await appendFile(join(this.runDir, "normalized-actions.jsonl"), `${JSON.stringify(action)}\n`);
		this.actions.push({ action_kind: action.action_kind, phase: action.phase, result: action.result });
		this.pending.delete(toolCallId);
	}

	public async stopped(reason: string): Promise<void> {
		await this.raw("run_stopped", "runner", { reason });
	}

	private elapsedMs(): number {
		return Number((process.hrtime.bigint() - this.startedAt) / 1_000_000n);
	}

	private async raw(type: string, actor: "pi" | "runner", data: Record<string, Json>): Promise<string> {
		const id = `evt-${String(++this.sequence).padStart(4, "0")}`;
		const event = {
			schema_version: "workshop-raw/v1",
			run_id: this.runId,
			seq: this.sequence,
			event_id: id,
			monotonic_ms: this.elapsedMs(),
			type,
			actor,
			parent_event_id: null,
			...data,
		};
		await appendFile(join(this.runDir, "raw-events.jsonl"), `${JSON.stringify(event)}\n`);
		return id;
	}

	private async saveArtifact(kind: "tool_args" | "tool_output", value: unknown): Promise<{ path: string; sha256: string; kind: Json }> {
		const contents = `${safeJson(value)}\n`;
		const sha256 = createHash("sha256").update(contents).digest("hex");
		const path = join("artifacts", `${sha256}.json`);
		await writeFile(join(this.runDir, path), contents);
		return { path, sha256, kind };
	}
}

export function classifyTool(toolName: string, args: unknown): { actionKind: ActionKind; phase: Phase; confidence: "HIGH" | "MEDIUM" | "LOW" } {
	const name = toolName.toLowerCase();
	if (["read", "ls"].includes(name)) return { actionKind: "read", phase: "OBSERVE", confidence: "HIGH" };
	if (["grep", "find"].includes(name)) return { actionKind: "search", phase: "OBSERVE", confidence: "HIGH" };
	if (["edit", "write"].includes(name)) return { actionKind: "edit", phase: "ACT", confidence: "HIGH" };
	if (name === "bash") {
		const command = commandFrom(args);
		if (isDestructive(command)) return { actionKind: "execute", phase: "UNKNOWN", confidence: "LOW" };
		if (/\b(npm\s+(run\s+)?test|npm\s+run\s+eval|pnpm\s+(run\s+)?test|vitest|jest|pytest|tsc\b|rtk\s+test\b)/.test(command)) {
			return { actionKind: "test", phase: "VERIFY", confidence: "MEDIUM" };
		}
		if (isCompound(command)) return { actionKind: "execute", phase: "UNKNOWN", confidence: "LOW" };
		if (/^\s*git\s+/.test(command)) return { actionKind: "version_control", phase: /^\s*git\s+(commit|add|push|checkout|switch)\b/.test(command) ? "ACT" : "OBSERVE", confidence: "MEDIUM" };
		return { actionKind: "execute", phase: "UNKNOWN", confidence: "LOW" };
	}
	return { actionKind: "other", phase: "UNKNOWN", confidence: "LOW" };
}

export function targetFor(toolName: string, args: unknown): string {
	const name = toolName.toLowerCase();
	if (name === "bash") return commandFrom(args).slice(0, 300) || "bash command unavailable";
	const values = objectValues(args);
	const path = stringValue(values, ["path", "filePath", "file_path", "directory", "dir"]);
	const pattern = stringValue(values, ["pattern", "query", "search", "glob"]);
	if (name === "grep" || name === "find") {
		const parts = [path ? `path=${path}` : undefined, pattern ? `pattern=${pattern}` : undefined].filter(Boolean);
		return parts.join("; ") || `${name} target unavailable`;
	}
	if (["read", "edit", "write", "ls"].includes(name)) return path ?? `${name} target unavailable`;
	return `${name} target unavailable`;
}

function commandFrom(args: unknown): string {
	if (!args || typeof args !== "object") return "";
	const command = (args as { command?: unknown }).command;
	return typeof command === "string" ? command : "";
}

function objectValues(args: unknown): Record<string, unknown> {
	return args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
}

function stringValue(values: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = values[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return undefined;
}

function isDestructive(command: string): boolean {
	return /\b(rm\s+(?:-[A-Za-z]*[rf]|--recursive|--force)|git\s+(?:reset\s+--hard|clean\b))/.test(command);
}

function isCompound(command: string): boolean {
	return /(?:&&|\|\||;|\||\n)/.test(command);
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, (_key, current) => {
			if (typeof current === "bigint") return current.toString();
			if (typeof current === "string" && current.length > 100_000) return `${current.slice(0, 100_000)}\n[truncated]`;
			return current;
		});
	} catch {
		return JSON.stringify({ unrecordable: String(value) });
	}
}
