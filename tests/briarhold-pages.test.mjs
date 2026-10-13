import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {comparePackageTrees, validateBriarholdPackage} from "../scripts/briarhold-package-core.mjs";

const hash = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

async function fixture(version = "0.3.0-alpha.103") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "briarhold-pages-"));
  const files = new Map([
    ["index.html", Buffer.from('<link rel="stylesheet" href="styles.0123456789abcdefabcd/game.css"><script src="vendor.0123456789abcdefabcd/lib.js"></script><script type="module" src="src.0123456789abcdefabcd/game.js"></script>')],
    ["src.0123456789abcdefabcd/game.js", Buffer.from("export const alpha = 103;\n")],
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

test("Alpha.103 Briarhold package validation authenticates exact inventory and hosted bytes", async t => {
  const source = await fixture();
  const hosted = await fixture();
  t.after(() => Promise.all([fs.rm(source, {recursive: true}), fs.rm(hosted, {recursive: true})]));
  const validated = await validateBriarholdPackage(source);
  assert.equal(validated.manifest.version, "0.3.0-alpha.103");
  assert.equal(validated.files.length, 6);
  await comparePackageTrees(source, hosted, {requireRetention: false});

  await fs.writeFile(path.join(hosted, "src.0123456789abcdefabcd", "game.js"), "tampered\n");
  await assert.rejects(comparePackageTrees(source, hosted, {requireRetention: false}), /does not match manifest/u);
});

test("Briarhold sync validation rejects an older package and unmanifested files", async t => {
  const old = await fixture("0.3.0-alpha.102");
  const extra = await fixture();
  t.after(() => Promise.all([fs.rm(old, {recursive: true}), fs.rm(extra, {recursive: true})]));
  await assert.rejects(validateBriarholdPackage(old), /Expected Briarhold 0\.3\.0-alpha\.103/u);
  await fs.writeFile(path.join(extra, "unexpected.txt"), "nope");
  await assert.rejects(validateBriarholdPackage(extra), /missing or unmanifested files/u);
});

test("hosted package accepts only a complete authenticated retired inventory", async t => {
  const source = await fixture();
  const hosted = await fixture();
  const one = Buffer.from("retired asset A\n");
  const two = Buffer.from("retired asset B\n");
  const retained = [
    {path: "assets/legacy-a.dat", bytes: one.length, sha256: hash(one)},
    {path: "src.0123456789abcdefabcd/legacy-b.js", bytes: two.length, sha256: hash(two)},
  ];
  t.after(() => Promise.all([fs.rm(source, {recursive: true}), fs.rm(hosted, {recursive: true})]));

  await fs.mkdir(path.join(hosted, "assets"), {recursive: true});
  await fs.writeFile(path.join(hosted, "assets", "legacy-a.dat"), one);
  await assert.rejects(comparePackageTrees(source, hosted, {retentionRecords: retained}), /incomplete/u);

  await fs.mkdir(path.dirname(path.join(hosted, ...retained[1].path.split("/"))), {recursive: true});
  await fs.writeFile(path.join(hosted, ...retained[1].path.split("/")), two);
  await comparePackageTrees(source, hosted, {retentionRecords: retained});
  await fs.writeFile(path.join(hosted, ...retained[0].path.split("/")), "tampered\n");
  await assert.rejects(comparePackageTrees(source, hosted, {retentionRecords: retained}), /authenticated Alpha\.102 manifest/u);
  await fs.writeFile(path.join(hosted, ...retained[0].path.split("/")), one);
  await fs.writeFile(path.join(hosted, "assets", "unlisted.dat"), "unlisted\n");
  await assert.rejects(comparePackageTrees(source, hosted, {retentionRecords: retained}), /unmanifested files/u);
});

test("Pages verifier authenticates retained files only for the designated website play source", async t => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = path.join(root, "games", "briarhold", "play");
  const stagedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "briarhold-pages-staged-"));
  const stagedPlay = path.join(stagedRoot, "games", "briarhold", "play");
  await fs.mkdir(path.dirname(stagedPlay), {recursive: true});
  await fs.cp(source, stagedPlay, {recursive: true});
  t.after(() => fs.rm(stagedRoot, {recursive: true, force: true}));

  await assert.rejects(validateBriarholdPackage(source), /missing or unmanifested files/u);
  const {spawnSync} = await import("node:child_process");
  const verifier = path.join(root, "scripts", "verify-briarhold-pages.mjs");
  const run = () => spawnSync(process.execPath, [verifier, "games/briarhold/play"], {
    cwd: root,
    env: {...process.env, BRIARHOLD_SITE_ROOT: stagedRoot},
    encoding: "utf8",
  });
  const valid = run();
  assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
  assert.match(valid.stdout, /244 current-package files match byte for byte; 222 authenticated Alpha\.102 runtime files/u);

  const spec = JSON.parse(await fs.readFile(path.join(root, "scripts", "briarhold-alpha102-retention.json"), "utf8"));
  const retainedPath = path.join(stagedPlay, ...spec.files[0].path.split("/"));
  await fs.writeFile(retainedPath, "tampered");
  const tampered = run();
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /authenticated Alpha\.102 manifest/u);
});

test("Briarhold landing and catalogue fallbacks expose browser Alpha.103 and experimental co-op", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [page, catalogue, homeFallback, gamesFallback] = await Promise.all([
    fs.readFile(path.join(root, "games", "briarhold", "index.html"), "utf8"),
    fs.readFile(path.join(root, "data", "projects.json"), "utf8"),
    fs.readFile(path.join(root, "index.html"), "utf8"),
    fs.readFile(path.join(root, "games", "index.html"), "utf8"),
  ]);
  assert.match(page, /href="\/games\/briarhold\/play\/"/u);
  assert.match(page, /Android APK · Alpha\.103/u);
  assert.match(catalogue, /Experimental Multiplayer Co-op/u);
  for (const fallback of [homeFallback, gamesFallback]) {
    assert.match(fallback, /available for Alpha\.103 testing/u);
    assert.match(fallback, /experimental multiplayer co-op/iu);
  }
});
