import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const rootAgents = await readFile(resolve(repositoryRoot, "AGENTS.md"), "utf8");
const workshopAgents = await readFile(resolve(repositoryRoot, "workshop/AGENTS.md"), "utf8");
const workshopAgent = await readFile(resolve(repositoryRoot, "workshop/WORKSHOP_AGENT.md"), "utf8");
const promptMap = await readFile(resolve(repositoryRoot, "workshop/prompts/README.md"), "utf8");

assert.match(rootAgents, /workshop\/AGENTS\.md/);
assert.match(rootAgents, /workshop\/WORKSHOP_AGENT\.md/);
assert.match(rootAgents, /workshop\/prompts\/README\.md/);

assert.match(workshopAgents, /prompts\/README\.md/);
assert.match(workshopAgents, /prompts\/TRACE_FAILURE_ANALYSIS\.md/);
assert.match(workshopAgents, /tasksets\/CHOOSE_A_TASKSET\.md/);
assert.match(workshopAgents, /optional continuation menu once/);

assert.match(workshopAgent, /prompts\/README\.md/);
assert.match(workshopAgent, /prompts\/TRACE_FAILURE_ANALYSIS\.md/);
assert.match(workshopAgent, /tasksets\/CHOOSE_A_TASKSET\.md/);
assert.match(workshopAgent, /Do not repeat\s+a completed model call/);

assert.match(promptMap, /Analyze my traces/);
assert.match(promptMap, /Try another failure pattern/);
assert.match(promptMap, /Stop here/);
assert.match(promptMap, /Do not silently choose a path/);

console.log("workshop prompt routing fixture passed");
