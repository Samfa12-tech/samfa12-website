import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const whatWouldWinRoot = process.env.WHAT_WOULD_WIN_ROOT
  ? path.resolve(process.env.WHAT_WOULD_WIN_ROOT)
  : path.join(os.homedir(), "Documents", "What Would Win");
const source = path.join(whatWouldWinRoot, "app", "dist");
const destination = path.join(root, "apps", "what-would-win");
const staging = path.join(root, "apps", ".what-would-win-staging");
const backup = path.join(root, "apps", ".what-would-win-backup");

async function validateBuild(buildRoot) {
  const indexPath = path.join(buildRoot, "index.html");
  const html = await fs.readFile(indexPath, "utf8");
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']*assets\/[^"']+)["']/gi)].map((match) => match[1]);
  if (!/<div\s+id=["']root["']/i.test(html) || !assets.length) {
    throw new Error(`What Would Win build is invalid: ${indexPath} is missing its app root or built asset references.`);
  }
  for (const asset of assets) await fs.access(path.join(buildRoot, asset));
  for (const required of [
    "site.webmanifest",
    "icons/favicon.ico",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "social/what-would-win-og.png",
  ]) await fs.access(path.join(buildRoot, required));
}

try {
  await validateBuild(source);
} catch {
  throw new Error(`What Would Win build is missing or incomplete under ${source}. Build the source app first.`);
}

await fs.rm(staging, { recursive: true, force: true });
await fs.rm(backup, { recursive: true, force: true });
await fs.cp(source, staging, { recursive: true });
await validateBuild(staging);

let movedExisting = false;
try {
  await fs.rename(destination, backup);
  movedExisting = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

try {
  await fs.rename(staging, destination);
  await fs.rm(backup, { recursive: true, force: true });
} catch (error) {
  if (movedExisting) await fs.rename(backup, destination);
  throw error;
}
console.log(`Synced What Would Win: ${source} -> ${destination}`);
