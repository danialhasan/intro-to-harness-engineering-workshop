import { copyFile } from "node:fs/promises";

await copyFile(new URL("../starter/request.ts", import.meta.url), new URL("../src/http/request.ts", import.meta.url));
console.log("Restored src/http/request.ts to the workshop starting implementation.");
