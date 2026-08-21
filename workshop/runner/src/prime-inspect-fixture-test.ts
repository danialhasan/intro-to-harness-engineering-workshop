import assert from "node:assert/strict";
import { resolve } from "node:path";
import { sanitizeFileTarget, summarizeCommand } from "./prime-inspect.js";

assert.equal(sanitizeFileTarget(resolve("src/http/request.ts")), "src/http/request.ts");
assert.equal(sanitizeFileTarget(resolve("private-client.txt")), "<absolute-path>");
assert.equal(summarizeCommand("npm run eval -- --unsafe-value hidden"), "npm run eval");
assert.equal(summarizeCommand("find . -maxdepth 3"), "repository inventory");
console.log("Prime trace summary privacy fixture passed");
