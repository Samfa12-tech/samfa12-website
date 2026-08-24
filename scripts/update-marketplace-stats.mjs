import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHistory, assertPublicStats, equivalentMarketplaceSnapshot, loadMarketplaceConfig, marketplaceChanges, projectMappings, validateMarketplaceConfig } from "./marketplace/core.mjs";
import { collectItch } from "./marketplace/itch.mjs";
import { collectGooglePlay } from "./marketplace/google-play.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadMarketplaceConfig({ cwd: root });
const missing = validateMarketplaceConfig(config);
if (missing.length) throw new Error(`Marketplace configuration is incomplete: ${missing.join(", ")}`);

const projects = JSON.parse(await readFile(path.join(root, "data", "projects.json"), "utf8"));
const maps = projectMappings(projects);
const statsPath = path.join(root, "data", "public-stats.json");
const historyPath = path.join(root, "data", "public-stats-history.json");
const previousStats = await readJsonOr(statsPath, { schemaVersion: 1, status: "uninitialised" });
const previousHistory = await readJsonOr(historyPath, { schemaVersion: 1, snapshots: [] });
assertPublicStats(previousStats);
assertHistory(previousHistory);

const [itch, googlePlay] = await Promise.all([
  collectItch({ apiKey: config.itchApiKey, projectNames: maps.itch }),
  collectGooglePlay({
    serviceAccountJson: config.googlePlayServiceAccountJson,
    serviceAccountJsonPath: config.googlePlayServiceAccountJsonPath,
    salesUri: config.googlePlaySalesUri,
    projectNames: maps.googlePlay,
  }),
]);

// Steam is refreshed only through the owner-exported CSV importer. Retain its
// existing sanitised baseline so a Steam API outage cannot block other stores.
const steam = { totals: previousStats.totals.steam, projects: previousStats.projects.steam };
const generatedAt = new Date().toISOString();
const amazon = previousStats.totals?.amazon;
const totals = {
  itch: itch.totals,
  steam: steam.totals,
  googlePlay: googlePlay.totals,
  ...(amazon ? { amazon } : {}),
  combined: { paidUnits: itch.totals.purchases + steam.totals.netUnits + googlePlay.totals.netPaidAppPurchases + (amazon?.netUnits || 0) },
};
const prior = previousHistory.snapshots.at(-1);
const snapshot = compactSnapshot(generatedAt, totals);
const publicStats = {
  schemaVersion: 1,
  generatedAt,
  totals,
  change: { sincePreviousSnapshot: marketplaceChanges(prior, totals) },
  projects: previousStats.projects?.amazon
    ? { itch: itch.projects, steam: steam.projects, googlePlay: googlePlay.projects, amazon: previousStats.projects.amazon }
    : { itch: itch.projects, steam: steam.projects, googlePlay: googlePlay.projects },
  futureProviders: previousStats.projects?.amazon
    ? (previousStats.futureProviders || []).filter((provider) => provider !== "amazon")
    : ["amazon"],
};
assertPublicStats(publicStats);
const history = {
  schemaVersion: 1,
  snapshots: equivalentMarketplaceSnapshot(prior, snapshot) ? previousHistory.snapshots : [...previousHistory.snapshots, snapshot],
};
assertHistory(history);

await writeBundle([
  [statsPath, JSON.stringify(publicStats, null, 2) + "\n"],
  [historyPath, JSON.stringify(history, null, 2) + "\n"],
]);
console.log("Updated sanitised public marketplace statistics.");

function compactSnapshot(capturedAt, values) {
  return {
    capturedAt,
    itch: { ...values.itch },
    steam: { netUnits: values.steam.netUnits },
    googlePlay: { netPaidAppPurchases: values.googlePlay.netPaidAppPurchases },
    ...(values.amazon ? { amazon: { netUnits: values.amazon.netUnits } } : {}),
    combined: { ...values.combined },
  };
}

async function readJsonOr(filePath, fallback) { try { return JSON.parse(await readFile(filePath, "utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw error; } }
async function writeBundle(entries) {
  const temporary = entries.map(([filePath, contents]) => [filePath, `${filePath}.${process.pid}.${Date.now()}.tmp`, contents]);
  await Promise.all(temporary.map(async ([filePath, temporaryPath, contents]) => { await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(temporaryPath, contents, "utf8"); }));
  await Promise.all(temporary.map(([filePath, temporaryPath]) => rename(temporaryPath, filePath)));
}
