import { copyFile } from "node:fs/promises";

await copyFile(new URL("../starter/import-plan.ts", import.meta.url), new URL("../src/import-plan.ts", import.meta.url));
console.log("Restored the context-contract starter.");
