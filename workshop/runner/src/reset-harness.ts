import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runnerRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(runnerRoot, "src", "participant-harness.ts");
const template = join(runnerRoot, "templates", "participant-harness.clean.ts");
const backupDir = join(runnerRoot, "backups");
const backup = join(backupDir, `participant-harness.${new Date().toISOString().replace(/[:.]/g, "-")}.ts`);
await mkdir(backupDir, { recursive: true });
await copyFile(target, backup);
const clean = await readFile(template, "utf8");
// The template imports types from its own directory. Restore the source-local import.
await writeFile(target, clean.replace('from "../src/types.js"', 'from "./types.js"'));
console.log(JSON.stringify({ restored: target, backup }, null, 2));
