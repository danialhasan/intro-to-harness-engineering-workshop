import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const current = resolve("policies/h4.md");
const backupDir = resolve("backups");
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = resolve(backupDir, `h4-${stamp}.md`);
await writeFile(backup, await readFile(current));
await copyFile(resolve("policies/h4.default.md"), current);
console.log(`H4 policy reset; backup: ${backup}`);
