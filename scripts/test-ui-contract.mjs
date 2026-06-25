import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const area of ["popup", "options"]) {
  const html = await readFile(new URL(`../src/${area}/${area}.html`, import.meta.url), "utf8");
  const js = await readFile(new URL(`../src/${area}/${area}.js`, import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const requested = new Set([...js.matchAll(/\$\("#([A-Za-z0-9_-]+)[^"]*"\)/g)].map((match) => match[1]));
  const missing = [...requested].filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `${area} JavaScript references missing HTML IDs: ${missing.join(", ")}`);
}

console.log("Popup and options UI contract tests passed.");
