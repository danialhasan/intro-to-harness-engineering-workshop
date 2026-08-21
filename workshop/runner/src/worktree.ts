import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const skippedNames = new Set([".git", "node_modules", ".DS_Store"]);

export async function createFreshWorktree(fixture: string, destination: string): Promise<void> {
	await rm(destination, { recursive: true, force: true });
	await mkdir(destination, { recursive: true });
	await cp(fixture, destination, {
		recursive: true,
		filter: (source) => !skippedNames.has(basename(source)),
	});
}

export async function treeHash(root: string): Promise<string> {
	const hash = createHash("sha256");
	async function visit(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
			if (skippedNames.has(entry.name)) continue;
			const path = join(current, entry.name);
			const rel = relative(root, path);
			if (entry.isDirectory()) {
				hash.update(`dir:${rel}\n`);
				await visit(path);
			} else if (entry.isFile()) {
				const info = await stat(path);
				hash.update(`file:${rel}:${info.size}\n`);
				hash.update(await readFile(path));
			}
		}
	}
	await visit(root);
	return hash.digest("hex");
}

export async function fileHash(path: string): Promise<string> {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}
