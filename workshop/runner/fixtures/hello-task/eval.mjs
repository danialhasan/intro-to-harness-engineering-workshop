import { mkdir, readFile, writeFile } from "node:fs/promises";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const report = args.get("--report");
const task = args.get("--task");
if (!report || !task) throw new Error("Expected --task and --report.");
const taskText = await readFile("TASK.md", "utf8");
await mkdir(new URL(".", `file://${report}`).pathname, { recursive: true }).catch(() => undefined);
await writeFile(report, JSON.stringify({
  schema_version: "workshop-eval/v1",
  completion_status: taskText.includes("no-model smoke") ? "COMPLETE" : "FAILED",
  hard_gates: {
    workspace_clean_start: "PASS",
    task_acceptance_tests: taskText.includes("no-model smoke") ? "PASS" : "FAIL"
  },
  evaluator: { fixture: true, task }
}, null, 2));
