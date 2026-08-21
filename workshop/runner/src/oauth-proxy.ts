import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { AddressInfo } from "node:net";

type JsonObject = Record<string, any>;

function textContent(value: unknown): string {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return "";
	return value
		.map((part) => (part && typeof part === "object" && (part as JsonObject).type === "text" ? String((part as JsonObject).text ?? "") : ""))
		.filter(Boolean)
		.join("\n");
}

function zeroUsage(): JsonObject {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
}

function convertContext(body: JsonObject): JsonObject {
	const system: string[] = [];
	const messages: JsonObject[] = [];
	for (const raw of Array.isArray(body.messages) ? body.messages : []) {
		if (!raw || typeof raw !== "object") continue;
		const message = raw as JsonObject;
		if (message.role === "system" || message.role === "developer") {
			system.push(textContent(message.content));
			continue;
		}
		if (message.role === "user") {
			messages.push({ role: "user", content: textContent(message.content), timestamp: Date.now() });
			continue;
		}
		if (message.role === "assistant") {
			const content: JsonObject[] = [];
			const text = textContent(message.content);
			if (text) content.push({ type: "text", text });
			for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
				const fn = call?.function ?? {};
				let args: JsonObject = {};
				try { args = JSON.parse(String(fn.arguments ?? "{}")); } catch { args = {}; }
				content.push({ type: "toolCall", id: String(call?.id ?? randomUUID()), name: String(fn.name ?? "unknown"), arguments: args });
			}
			messages.push({ role: "assistant", content, api: "openai-codex-responses", provider: "openai-codex", model: "gpt-5.5", usage: zeroUsage(), stopReason: content.some((part) => part.type === "toolCall") ? "toolUse" : "stop", timestamp: Date.now() });
			continue;
		}
		if (message.role === "tool") {
			messages.push({ role: "toolResult", toolCallId: String(message.tool_call_id ?? "unknown"), toolName: String(message.name ?? "tool"), content: [{ type: "text", text: textContent(message.content) }], isError: false, timestamp: Date.now() });
		}
	}
	const tools = (Array.isArray(body.tools) ? body.tools : [])
		.filter((tool) => tool?.type === "function" && tool.function)
		.map((tool) => ({ name: String(tool.function.name), description: String(tool.function.description ?? ""), parameters: tool.function.parameters ?? { type: "object", properties: {} } }));
	return { systemPrompt: system.filter(Boolean).join("\n\n"), messages, tools };
}

function openAiMessage(response: JsonObject): JsonObject {
	const text = (response.content ?? []).filter((part: JsonObject) => part.type === "text").map((part: JsonObject) => part.text).join("");
	const toolCalls = (response.content ?? []).filter((part: JsonObject) => part.type === "toolCall").map((part: JsonObject) => ({ id: part.id, type: "function", function: { name: part.name, arguments: JSON.stringify(part.arguments ?? {}) } }));
	return { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) };
}

function usage(response: JsonObject): JsonObject {
	const value = response.usage ?? {};
	return { prompt_tokens: Number(value.input ?? 0), completion_tokens: Number(value.output ?? 0), total_tokens: Number(value.totalTokens ?? 0) };
}

async function readJson(request: IncomingMessage): Promise<JsonObject> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request) {
		const data = Buffer.from(chunk);
		size += data.length;
		if (size > 20 * 1024 * 1024) throw new Error("request body is too large");
		chunks.push(data);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonObject;
}

function writeJson(response: ServerResponse, status: number, body: JsonObject): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
}

export async function startOAuthProxy(expectedKey: string, port = 8787): Promise<{ close: () => Promise<void>; url: string }> {
	const runtime = await ModelRuntime.create();
	const model = runtime.getModel("openai-codex", "gpt-5.5");
	if (!model || !runtime.hasConfiguredAuth("openai-codex") || !runtime.isUsingSubscription("openai-codex")) {
		throw new Error("Pi OpenAI Codex subscription login is not ready. Run npx --no-install pi and use /login.");
	}
	const server = createServer(async (request, response) => {
		try {
			if (request.method !== "POST" || request.url !== "/v1/chat/completions") return writeJson(response, 404, { error: { message: "not found" } });
			if (request.headers.authorization !== `Bearer ${expectedKey}`) return writeJson(response, 401, { error: { message: "unauthorized" } });
			const body = await readJson(request);
			const result = await runtime.completeSimple(model, convertContext(body) as never, { reasoning: "medium", maxTokens: 8192, sessionId: typeof request.headers["x-session-id"] === "string" ? request.headers["x-session-id"] : undefined }) as JsonObject;
			if (result.stopReason === "error" || result.stopReason === "aborted") throw new Error(String(result.errorMessage ?? `model stopped: ${result.stopReason}`));
			const id = `chatcmpl-${randomUUID()}`;
			const created = Math.floor(Date.now() / 1000);
			const message = openAiMessage(result);
			const finishReason = message.tool_calls ? "tool_calls" : result.stopReason === "length" ? "length" : "stop";
			if (body.stream === true) {
				response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
				const delta: JsonObject = { role: "assistant" };
				if (typeof message.content === "string" && message.content) delta.content = message.content;
				if (Array.isArray(message.tool_calls)) {
					delta.tool_calls = message.tool_calls.map((call: JsonObject, index: number) => ({
						index,
						id: call.id,
						type: "function",
						function: call.function,
					}));
				}
				response.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "gpt-5.5", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
				response.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "gpt-5.5", choices: [{ index: 0, delta: {}, finish_reason: finishReason }], usage: usage(result) })}\n\n`);
				response.end("data: [DONE]\n\n");
				return;
			}
			writeJson(response, 200, { id, object: "chat.completion", created, model: "gpt-5.5", choices: [{ index: 0, message, finish_reason: finishReason }], usage: usage(result) });
		} catch (error) {
			writeJson(response, 502, { error: { message: error instanceof Error ? error.message : String(error), type: "workshop_oauth_proxy_error" } });
		}
	});
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve()); });
	const address = server.address() as AddressInfo;
	return { url: `http://127.0.0.1:${address.port}/v1`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
