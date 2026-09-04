import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const METADATA_FILES = new Set(["release-manifest.json", "SHA256SUMS.txt"]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function filesUnder(root, current = root) {
  const result = [];
  for (const entry of await fs.readdir(current, {withFileTypes: true})) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, absolute));
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join("/"));
    else throw new Error(`Briarhold package contains unsupported entry: ${absolute}`);
  }
  return result.sort();
}

function safeRelative(value) {
  return typeof value === "string"
    && value.length > 0
    && value === value.replace(/\\/g, "/")
    && !value.startsWith("/")
    && !value.split("/").includes("..")
    && !/^[a-z]:/i.test(value);
}

export async function validateBriarholdPackage(packageRoot, {requireAlpha97 = true} = {}) {
  const root = path.resolve(packageRoot);
  const manifestBuffer = await fs.readFile(path.join(root, "release-manifest.json"));
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));
  if (manifest.schemaVersion !== 2 || manifest.package !== "briarhold" || manifest.entrypoint !== "index.html") {
    throw new Error("Briarhold release manifest metadata is invalid.");
  }
  if (requireAlpha97 && manifest.version !== "0.3.0-alpha.97") {
    throw new Error(`Expected Briarhold 0.3.0-alpha.97, received ${manifest.version ?? "unknown"}.`);
  }
  if (!/^[a-f0-9]{20}$/.test(manifest.cacheKey) || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error("Briarhold release manifest cache key or files are invalid.");
  }
  const indexHtml = await fs.readFile(path.join(root, "index.html"), "utf8");
  for (const directory of ["src", "styles", "vendor"]) {
    const prefix = `${directory}.${manifest.cacheKey}/`;
    if (!indexHtml.includes(prefix) || !manifest.files.some(record => record?.path?.startsWith(prefix))) {
      throw new Error(`Briarhold package is missing relative content-addressed ${directory} assets.`);
    }
    if (indexHtml.includes(`/${prefix}`)) throw new Error(`Briarhold ${directory} asset references must remain relative.`);
  }

  const expected = new Set(["release-manifest.json", "SHA256SUMS.txt"]);
  for (const record of manifest.files) {
    if (!safeRelative(record?.path) || expected.has(record.path)) throw new Error(`Unsafe or duplicate manifest path: ${record?.path}`);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`Invalid manifest record: ${record.path}`);
    }
    expected.add(record.path);
    const buffer = await fs.readFile(path.join(root, ...record.path.split("/")));
    if (buffer.length !== record.bytes || sha256(buffer) !== record.sha256) {
      throw new Error(`Briarhold package file does not match manifest: ${record.path}`);
    }
  }
  const actual = await filesUnder(root);
  const expectedSorted = [...expected].sort();
  if (actual.length !== expectedSorted.length || actual.some((file, index) => file !== expectedSorted[index])) {
    throw new Error("Briarhold package contains missing or unmanifested files.");
  }

  const sumsText = await fs.readFile(path.join(root, "SHA256SUMS.txt"), "utf8");
  const sums = new Map(sumsText.trim().split(/\r?\n/).map(line => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !safeRelative(match[2])) throw new Error(`Invalid SHA256SUMS entry: ${line}`);
    return [match[2], match[1]];
  }));
  if (sums.size !== manifest.files.length + 1 || sums.get("release-manifest.json") !== sha256(manifestBuffer)) {
    throw new Error("SHA256SUMS.txt does not authenticate the complete release manifest.");
  }
  for (const record of manifest.files) {
    if (sums.get(record.path) !== record.sha256) throw new Error(`SHA256SUMS mismatch: ${record.path}`);
  }
  return {root, manifest, files: actual};
}

export async function comparePackageTrees(leftRoot, rightRoot) {
  const left = await validateBriarholdPackage(leftRoot);
  const right = await validateBriarholdPackage(rightRoot);
  if (JSON.stringify(left.files) !== JSON.stringify(right.files)) throw new Error("Hosted Briarhold file inventory differs from the supplied package.");
  for (const file of left.files) {
    const [leftBuffer, rightBuffer] = await Promise.all([
      fs.readFile(path.join(left.root, ...file.split("/"))),
      fs.readFile(path.join(right.root, ...file.split("/"))),
    ]);
    if (!leftBuffer.equals(rightBuffer)) throw new Error(`Hosted Briarhold file differs from package: ${file}`);
  }
  return left;
}
