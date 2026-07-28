import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectClarity,
  collectCloudflare,
  loadAnalyticsConfig,
  validateAnalyticsConfig,
} from "./analytics-core.mjs";

const cwd = process.cwd();
const config = await loadAnalyticsConfig({ cwd });
const missing = validateAnalyticsConfig(config);
const checkOnly = process.argv.includes("--check");

if (missing.length) {
  console.error(`Analytics configuration is incomplete: ${missing.join(", ")}`);
  console.error(`Copy .env.analytics.example to ${config.envPath} and add read-only tokens.`);
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(`Analytics configuration is complete for ${config.hostname}.`);
} else {
  const capturedAt = new Date();
  const [clarity, cloudflare] = await Promise.all([
    collectClarity({ apiToken: config.clarityApiToken, days: 1 }),
    collectCloudflare({
      apiToken: config.cloudflareApiToken,
      zoneId: config.cloudflareZoneId,
      hostname: config.hostname,
      lookbackDays: config.lookbackDays,
      now: capturedAt,
    }),
  ]);
  const snapshot = {
    schemaVersion: 1,
    capturedAt: capturedAt.toISOString(),
    privacy: "aggregate-only; URL query strings removed; no session recordings",
    clarity,
    cloudflare,
  };
  const snapshotDirectory = path.join(cwd, ".analytics", "snapshots");
  await mkdir(snapshotDirectory, { recursive: true });
  const filename = `${capturedAt.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}.json`;
  const outputPath = path.join(snapshotDirectory, filename);
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Saved aggregate analytics snapshot: ${outputPath}`);
}
