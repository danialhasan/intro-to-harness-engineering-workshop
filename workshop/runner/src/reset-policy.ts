import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const current = resolve("policies/participant.md");
const backupDir = resolve("backups");
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = resolve(backupDir, `participant-${stamp}.md`);
await writeFile(backup, await readFile(current));
await copyFile(resolve("policies/participant.default.md"), current);
console.log(`policy reset; backup: ${backup}`);
