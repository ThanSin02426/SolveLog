import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname;
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const required = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((item) => item.js)
];

for (const path of required) {
  await stat(join(root, path));
}

const jsFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) jsFiles.push(full);
  }
}
await walk(join(root, "src"));
await walk(join(root, "scripts"));

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`Syntax error in ${relative(root, file)}\n${result.stderr}`);
    process.exit(1);
  }
}

console.log(`Validated manifest and ${jsFiles.length} JavaScript files.`);
