import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
const worker = "export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };\n";
await writeFile("dist/server/index.js", worker);
