import { copyFile } from "node:fs/promises";

await copyFile(new URL("../starter/release-plan.ts", import.meta.url), new URL("../src/release-plan.ts", import.meta.url));
console.log("Restored the dependency-integration starter.");
