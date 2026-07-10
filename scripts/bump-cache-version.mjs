import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const version = process.argv[2] || `${today}-1`;

if (!/^\d{8}-\d+$/.test(version)) {
  throw new Error("Cache version must use YYYYMMDD-N, for example 20260711-1.");
}

const htmlFiles = [
  "index.html",
  "404.html",
  "games/index.html",
  "books/index.html",
  "pocket-audio/index.html",
  "apps/index.html",
  "apps/pocket-audio-handoff/index.html",
  "music/index.html",
  "links/index.html",
  "join/index.html",
  "privacy/index.html",
];

for (const relativePath of htmlFiles) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const source = fs.readFileSync(filePath, "utf8");
  const updated = source
    .replace(/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`)
    .replace(/script\.js\?v=[^"']+/g, `script.js?v=${version}`);
  fs.writeFileSync(filePath, updated);
}

const scriptPath = path.join(root, "script.js");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const scriptUpdated = scriptSource.replace(
  /const DATA_VERSION = "[^"]+";/,
  `const DATA_VERSION = "${version}";`
);
fs.writeFileSync(scriptPath, scriptUpdated);

console.log(`Updated shared asset and catalogue cache version to ${version}.`);
