import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { sanitizeFileTarget, summarizeCommand, traceEvidence } from "./prime-inspect.js";

assert.equal(sanitizeFileTarget(resolve("src/http/request.ts")), "src/http/request.ts");
assert.equal(sanitizeFileTarget(resolve("private-client.txt")), "<absolute-path>");
assert.equal(summarizeCommand("npm run eval -- --unsafe-value hidden"), "npm run eval");
assert.equal(summarizeCommand("find . -maxdepth 3"), "repository inventory");
const fixture = await mkdtemp(join(tmpdir(), "ladder-trace-"));
const call = (name: string, args: Record<string, string>) => ({ name, arguments: args });
const nodes = [
	{ message: { role: "assistant", tool_calls: [call("read", { path: "TASK.md" }), call("read", { path: "docs/api-contract.md" })] } },
	{ message: { role: "assistant", tool_calls: [call("bash", { command: "npm test" })] } },
	{ message: { role: "assistant", tool_calls: [call("edit", { path: "src/http/request.ts" })] } },
	{ message: { role: "assistant", tool_calls: [call("bash", { command: "npm test && npm run check && npm run eval" })] } },
];
await writeFile(join(fixture, "traces.jsonl"), `${JSON.stringify({ traces: [{ nodes }] })}\n`);
const evidence = await traceEvidence(fixture);
assert.equal(evidence.readsContractBeforeFirstEdit, true);
assert.equal(evidence.runsTestBeforeFirstEdit, true);
assert.equal(evidence.verifiesAfterFinalEdit, true);
assert.equal(evidence.turns, 4);
assert.equal(evidence.actions.length, 5);
console.log("Prime trace summary privacy fixture passed");
