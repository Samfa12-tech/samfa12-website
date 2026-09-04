import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import {validateBriarholdPackage} from "./briarhold-package-core.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArg = process.argv[2];
if (!sourceArg) throw new Error("Usage: npm run sync:briarhold -- <verified Briarhold package directory>");
const source = path.resolve(sourceArg);
const destination = path.join(siteRoot, "games", "briarhold", "play");
const parent = path.dirname(destination);
const transaction = randomUUID();
const staging = path.join(parent, `.play-staging-${transaction}`);
const backup = path.join(parent, `.play-backup-${transaction}`);
const validated = await validateBriarholdPackage(source);
const realRoot = await fs.realpath(siteRoot);
const realParent = await fs.realpath(parent);
if (!realParent.startsWith(realRoot + path.sep)) throw new Error("Briarhold destination escapes the website worktree.");
for (const target of [destination, staging, backup]) {
  if (path.dirname(path.resolve(target)) !== parent) throw new Error("Unsafe Briarhold sync target.");
}
// Unique transaction paths preserve any interrupted sync's recovery copy.
await fs.cp(source, staging, {recursive: true});
await validateBriarholdPackage(staging);

let movedExisting = false;
try {
  await fs.rename(destination, backup);
  movedExisting = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
try {
  await fs.rename(staging, destination);
  await fs.rm(backup, {recursive: true, force: true});
} catch (error) {
  if (movedExisting) await fs.rename(backup, destination);
  throw error;
}
console.log(`Synced Briarhold ${validated.manifest.version} (${validated.files.length} exact files): ${source} -> ${destination}`);
