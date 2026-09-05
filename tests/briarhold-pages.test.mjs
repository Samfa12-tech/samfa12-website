import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {comparePackageTrees, validateBriarholdPackage} from "../scripts/briarhold-package-core.mjs";

const hash = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

async function fixture(version = "0.3.0-alpha.98") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "briarhold-pages-"));
  const files = new Map([
    ["index.html", Buffer.from('<link rel="stylesheet" href="styles.0123456789abcdefabcd/game.css"><script src="vendor.0123456789abcdefabcd/lib.js"></script><script type="module" src="src.0123456789abcdefabcd/game.js"></script>')],
    ["src.0123456789abcdefabcd/game.js", Buffer.from("export const alpha = 98;\n")],
    ["styles.0123456789abcdefabcd/game.css", Buffer.from("body{}\n")],
    ["vendor.0123456789abcdefabcd/lib.js", Buffer.from("// vendor\n")],
  ]);
  for (const [relative, buffer] of files) {
    const target = path.join(root, ...relative.split("/"));
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, buffer);
  }
  const manifest = {
    schemaVersion: 2,
    package: "briarhold",
    version,
    entrypoint: "index.html",
    cacheKey: "0123456789abcdefabcd",
    files: [...files].map(([relative, buffer]) => ({path: relative, bytes: buffer.length, sha256: hash(buffer)})),
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(root, "release-manifest.json"), manifestBuffer);
  await fs.writeFile(path.join(root, "SHA256SUMS.txt"), `${[
    ...manifest.files.map(record => `${record.sha256}  ${record.path}`),
    `${hash(manifestBuffer)}  release-manifest.json`,
  ].join("\n")}\n`);
  return root;
}

test("Alpha.98 Briarhold package validation authenticates exact inventory and hosted bytes", async t => {
  const source = await fixture();
  const hosted = await fixture();
  t.after(() => Promise.all([fs.rm(source, {recursive: true}), fs.rm(hosted, {recursive: true})]));
  const validated = await validateBriarholdPackage(source);
  assert.equal(validated.manifest.version, "0.3.0-alpha.98");
  assert.equal(validated.files.length, 6);
  await comparePackageTrees(source, hosted);

  await fs.writeFile(path.join(hosted, "src.0123456789abcdefabcd", "game.js"), "tampered\n");
  await assert.rejects(comparePackageTrees(source, hosted), /does not match manifest/u);
});

test("Briarhold sync validation rejects an older package and unmanifested files", async t => {
  const old = await fixture("0.3.0-alpha.97");
  const extra = await fixture();
  t.after(() => Promise.all([fs.rm(old, {recursive: true}), fs.rm(extra, {recursive: true})]));
  await assert.rejects(validateBriarholdPackage(old), /Expected Briarhold 0\.3\.0-alpha\.98/u);
  await fs.writeFile(path.join(extra, "unexpected.txt"), "nope");
  await assert.rejects(validateBriarholdPackage(extra), /missing or unmanifested files/u);
});

test("Briarhold landing and catalogue fallbacks expose browser Alpha.98 and experimental co-op", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [page, catalogue, fallback] = await Promise.all([
    fs.readFile(path.join(root, "games", "briarhold", "index.html"), "utf8"),
    fs.readFile(path.join(root, "data", "projects.json"), "utf8"),
    fs.readFile(path.join(root, "script.js"), "utf8"),
  ]);
  assert.match(page, /href="\/games\/briarhold\/play\/"/u);
  assert.match(page, /Android APK · Alpha\.98/u);
  assert.match(catalogue, /Experimental Multiplayer Co-op/u);
  assert.match(fallback, /experimental multiplayer co-op/u);
});
