import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const METADATA_FILES = new Set(["release-manifest.json", "SHA256SUMS.txt"]);
const CURRENT_VERSION = "0.3.0-alpha.103";
const PRIOR_VERSION = "0.3.0-alpha.102";
const PRIOR_RETENTION_SPEC_URL = new URL("./briarhold-alpha102-retention.json", import.meta.url);

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

export async function validateBriarholdPackage(packageRoot, {expectedVersion = CURRENT_VERSION, retainedRecords = []} = {}) {
  const root = path.resolve(packageRoot);
  const manifestBuffer = await fs.readFile(path.join(root, "release-manifest.json"));
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));
  if (manifest.schemaVersion !== 2 || manifest.package !== "briarhold" || manifest.entrypoint !== "index.html") {
    throw new Error("Briarhold release manifest metadata is invalid.");
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(`Expected Briarhold ${expectedVersion}, received ${manifest.version ?? "unknown"}.`);
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
  for (const record of retainedRecords) {
    if (!safeRelative(record?.path) || expected.has(record.path)) {
      throw new Error(`Unsafe, duplicate, or overlapping retained Briarhold path: ${record?.path}`);
    }
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`Invalid retained Briarhold file record: ${record.path}`);
    }
    expected.add(record.path);
    const buffer = await fs.readFile(path.join(root, ...record.path.split("/")));
    if (buffer.length !== record.bytes || sha256(buffer) !== record.sha256) {
      throw new Error(`Retained Briarhold file does not match its authenticated Alpha.102 manifest: ${record.path}`);
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
  return {root, manifest, files: actual, retainedFiles: retainedRecords.map(record => record.path).sort()};
}

async function loadPriorRetentionSpec() {
  const specBuffer = await fs.readFile(PRIOR_RETENTION_SPEC_URL);
  const spec = JSON.parse(specBuffer.toString("utf8"));
  const expectedPrefixes = ["assets/", "src.2fb2a6f489afe66e2710/", "styles.2fb2a6f489afe66e2710/", "vendor.2fb2a6f489afe66e2710/"];
  if (spec.schemaVersion !== 1 || spec.version !== PRIOR_VERSION || spec.cacheKey !== "2fb2a6f489afe66e2710"
      || spec.manifestSha256 !== "6300c12b7b3f62f71a8200bcc74b90fdd1f9638477d1b20e652edf41db4ef5df"
      || sha256(specBuffer) !== "73bc00658905cd3110a38377a40d1a84dea71bb823e9f987d271d5b47f971b1c"
      || JSON.stringify(spec.retainedPrefixes) !== JSON.stringify(expectedPrefixes)
      || !Array.isArray(spec.files) || spec.files.length !== 222) {
    throw new Error("The pinned Alpha.102 retention record is invalid.");
  }
  for (const record of spec.files) {
    if (!safeRelative(record?.path) || !Number.isSafeInteger(record.bytes) || record.bytes < 0
        || !/^[a-f0-9]{64}$/.test(record.sha256)
        || !spec.retainedPrefixes.some(prefix => record.path.startsWith(prefix))) {
      throw new Error(`Invalid pinned Alpha.102 retention file: ${record?.path}`);
    }
  }
  return spec;
}

export async function validatePriorBriarholdPackage(packageRoot) {
  const prior = await validateBriarholdPackage(packageRoot, {expectedVersion: PRIOR_VERSION});
  const spec = await loadPriorRetentionSpec();
  const manifestBuffer = await fs.readFile(path.join(prior.root, "release-manifest.json"));
  if (sha256(manifestBuffer) !== spec.manifestSha256 || prior.manifest.cacheKey !== spec.cacheKey) {
    throw new Error("The prior Briarhold package does not match the authenticated Alpha.102 retention source.");
  }
  const selected = prior.manifest.files.filter(record => spec.retainedPrefixes.some(prefix => record.path.startsWith(prefix)));
  if (JSON.stringify(selected) !== JSON.stringify(spec.files)) {
    throw new Error("The authenticated Alpha.102 package does not match the pinned retained-file inventory.");
  }
  return {...prior, retainedRecords: spec.files};
}

async function presentRetainedRecords(hostedRoot, records, required) {
  let present = 0;
  for (const record of records) {
    try {
      const stat = await fs.stat(path.join(hostedRoot, ...record.path.split("/")));
      if (!stat.isFile()) throw new Error(`Retained Briarhold path is not a file: ${record.path}`);
      present += 1;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (present !== 0 && present !== records.length) {
    throw new Error(`Hosted Alpha.102 compatibility assets are incomplete: ${present} of ${records.length} authenticated files are present.`);
  }
  if (required && present === 0) throw new Error("Hosted Briarhold is missing the complete authenticated Alpha.102 compatibility inventory.");
  return present ? records : [];
}

export async function comparePackageTrees(leftRoot, rightRoot, {retentionRecords = null, requireRetention = true, sourceHasAuthenticatedRetention = false} = {}) {
  const records = retentionRecords ?? (await loadPriorRetentionSpec()).files;
  const left = await validateBriarholdPackage(leftRoot, {
    retainedRecords: sourceHasAuthenticatedRetention ? records : [],
  });
  const retainedRecords = await presentRetainedRecords(rightRoot, records, requireRetention);
  const right = await validateBriarholdPackage(rightRoot, {retainedRecords});
  const currentPackageFiles = left.files.filter(file => !records.some(record => record.path === file));
  if (JSON.stringify(currentPackageFiles) !== JSON.stringify(right.files.filter(file => !retainedRecords.some(record => record.path === file)))) {
    throw new Error("Hosted Briarhold current-package inventory differs from the supplied package.");
  }
  for (const file of left.files) {
    const [leftBuffer, rightBuffer] = await Promise.all([
      fs.readFile(path.join(left.root, ...file.split("/"))),
      fs.readFile(path.join(right.root, ...file.split("/"))),
    ]);
    if (!leftBuffer.equals(rightBuffer)) throw new Error(`Hosted Briarhold file differs from package: ${file}`);
  }
  return {...left, files: currentPackageFiles, retainedFiles: right.retainedFiles};
}
