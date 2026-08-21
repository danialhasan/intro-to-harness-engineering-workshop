import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const policies = await Promise.all(["h0", "h1", "h2", "h3", "h4.default"].map((name) => readFile(resolve("policies", `${name}.md`), "utf8")));
for (let index = 1; index < policies.length; index += 1) assert.ok(policies[index].startsWith(policies[index - 1].trimEnd()), `policy ${index} must contain the complete preceding policy`);
assert.doesNotMatch(policies[0], /api-contract|npm test|npm run check/);
assert.match(policies[1], /docs\/api-contract\.md/);
assert.match(policies[2], /Before the first edit, run npm test/);
assert.match(policies[3], /After the final edit, run npm test, npm run check, and npm run eval/);
assert.match(policies[4], /PARTICIPANT EDIT START/);
console.log("cumulative H0-H4 policy fixture tests passed");
