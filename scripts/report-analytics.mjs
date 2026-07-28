import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAnalyticsReport } from "./analytics-core.mjs";

const cwd = process.cwd();
const snapshotDirectory = path.join(cwd, ".analytics", "snapshots");
const reportDirectory = path.join(cwd, ".analytics", "reports");
let names = [];

try {
  names = (await readdir(snapshotDirectory)).filter((name) => name.endsWith(".json")).sort();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const snapshots = [];
for (const name of names) {
  snapshots.push(JSON.parse(await readFile(path.join(snapshotDirectory, name), "utf8")));
}

const report = buildAnalyticsReport(snapshots);
await mkdir(reportDirectory, { recursive: true });
const outputPath = path.join(reportDirectory, "latest.md");
await writeFile(outputPath, report, "utf8");
console.log(`Saved analytics report: ${outputPath}`);
