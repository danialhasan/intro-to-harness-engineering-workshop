import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const START = "<!-- PARTICIPANT EDIT START -->";
const END = "<!-- PARTICIPANT EDIT END -->";

function splitPolicy(text: string): [string, string, string] {
	const start = text.indexOf(START);
	const end = text.indexOf(END);
	if (start < 0 || end < 0 || end <= start || text.indexOf(START, start + 1) >= 0 || text.indexOf(END, end + 1) >= 0) throw new Error("participant policy must contain one ordered edit boundary");
	return [text.slice(0, start + START.length), text.slice(start + START.length, end), text.slice(end)];
}

export async function validateParticipantPolicy(requireChange: boolean): Promise<void> {
	const current = splitPolicy(await readFile(resolve("policies/participant.md"), "utf8"));
	const starter = splitPolicy(await readFile(resolve("policies/participant.default.md"), "utf8"));
	if (current[0] !== starter[0] || current[2].trimEnd() !== starter[2].trimEnd()) throw new Error("Only text inside the participant edit boundary may change. Run npm run reset:policy to recover.");
	if (!current[1].trim()) throw new Error("The participant edit boundary must contain at least one instruction.");
	if (requireChange && current[1] === starter[1]) throw new Error("The participant policy is unchanged. Make one small edit inside the marked boundary before the changed run.");
}

if (process.argv[1]?.endsWith("validate-policy.ts")) void validateParticipantPolicy(process.argv.includes("--require-change")).then(() => console.log("participant policy boundary valid"));
