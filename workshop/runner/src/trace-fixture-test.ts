import assert from "node:assert/strict";
import { classifyTool, targetFor } from "./trace.js";

assert.equal(targetFor("read", { path: "src/http/request.ts", limit: 200 }), "src/http/request.ts");
assert.equal(targetFor("edit", { path: "src/http/request.ts", edits: [] }), "src/http/request.ts");
assert.equal(targetFor("write", { path: "docs/notes.md", content: "x" }), "docs/notes.md");
assert.equal(targetFor("ls", { path: "." }), ".");
assert.equal(targetFor("grep", { path: "src", pattern: "retry" }), "path=src; pattern=retry");
assert.equal(targetFor("find", { path: "../../repo", pattern: "AGENTS.md" }), "path=../../repo; pattern=AGENTS.md");
assert.equal(classifyTool("bash", { command: "git diff -- src/http/request.ts" }).actionKind, "version_control");
assert.equal(classifyTool("bash", { command: "rm -rf tmp && git status" }).actionKind, "execute");
assert.equal(classifyTool("bash", { command: "npm test && git status" }).actionKind, "test");
assert.equal(classifyTool("bash", { command: "rtk test npm run eval && git status" }).actionKind, "test");
assert.equal(classifyTool("bash", { command: "rm -rf tmp && npm test" }).actionKind, "execute");
console.log("trace fixture tests passed");
