import { copyFile } from "node:fs/promises";

await copyFile(new URL("../starter/release-decision.ts", import.meta.url), new URL("../src/release-decision.ts", import.meta.url));
console.log("Restored the verification-stopping starter.");
