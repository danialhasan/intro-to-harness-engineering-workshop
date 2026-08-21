import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIsolatedResourceLoader, WORKSHOP_RESOURCE_ISOLATION } from "./isolation.js";

const root = await mkdtemp(join(tmpdir(), "pi-isolation-fixture-"));
const agentDir = join(root, "agent");
const fixture = join(root, "fixture");
await Promise.all([
	mkdir(join(agentDir, "extensions"), { recursive: true }),
	mkdir(join(agentDir, "skills", "sentinel"), { recursive: true }),
	mkdir(join(agentDir, "prompts"), { recursive: true }),
	mkdir(join(agentDir, "themes"), { recursive: true }),
	mkdir(fixture, { recursive: true }),
]);
await Promise.all([
	writeFile(join(agentDir, "AGENTS.md"), "SENTINEL_CONTEXT"),
	writeFile(join(fixture, "AGENTS.md"), "SENTINEL_FIXTURE_CONTEXT"),
	writeFile(join(agentDir, "SYSTEM.md"), "SENTINEL_SYSTEM"),
	writeFile(join(agentDir, "APPEND_SYSTEM.md"), "SENTINEL_APPEND"),
	writeFile(join(agentDir, "extensions", "sentinel.ts"), "export default () => {};"),
	writeFile(join(agentDir, "skills", "sentinel", "SKILL.md"), "---\nname: sentinel\n---\nSENTINEL_SKILL"),
	writeFile(join(agentDir, "prompts", "sentinel.md"), "SENTINEL_PROMPT"),
	writeFile(join(agentDir, "themes", "sentinel.json"), "{}"),
]);
const loader = createIsolatedResourceLoader({ cwd: fixture, agentDir, harnessRules: "SENTINEL_HARNESS" });
await loader.reload();
assert.equal(loader.getAgentsFiles().agentsFiles.length, 0);
assert.equal(loader.getSkills().skills.length, 0);
assert.equal(loader.getExtensions().extensions.length, 0);
assert.equal(loader.getPrompts().prompts.length, 0);
assert.equal(loader.getThemes().themes.length, 0);
assert.deepEqual(loader.getAppendSystemPrompt(), []);
assert.doesNotMatch(loader.getSystemPrompt() ?? "", /SENTINEL_(CONTEXT|FIXTURE_CONTEXT|SYSTEM|APPEND|SKILL|PROMPT)/);
assert.match(loader.getSystemPrompt() ?? "", /SENTINEL_HARNESS/);
assert.equal(WORKSHOP_RESOURCE_ISOLATION.strategy, "explicit-resource-loader-overrides/v1");
console.log("resource isolation integration test passed");
