import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHistory, assertPublicStats, equivalentMarketplaceSnapshot, marketplaceChanges, projectMappings, sanitizeSteamState } from "./marketplace/core.mjs";
import { parseSteamSalesCsv } from "./marketplace/steam-csv.mjs";
import { summarizeSteamState } from "./marketplace/steam.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { csvPath, appId } = parseArguments(process.argv.slice(2));
const projects = JSON.parse(await readFile(path.join(root, "data", "projects.json"), "utf8"));
const maps = projectMappings(projects);
if (!maps.steam.has(appId)) throw new Error("--app-id must be a Steam app listed in data/projects.json.");

const statePath = path.join(root, "ops", "marketplace", "steam-state.json");
const statsPath = path.join(root, "data", "public-stats.json");
const historyPath = path.join(root, "data", "public-stats-history.json");
const [source, previousState, previousStats, previousHistory] = await Promise.all([
  readFile(csvPath, "utf8"),
  readJson(statePath),
  readJson(statsPath),
  readJson(historyPath),
]);
assertPublicStats(previousStats);
assertHistory(previousHistory);

const parsedDaily = parseSteamSalesCsv(source);
const state = sanitizeSteamState(previousState);
for (const daily of Object.values(state.daily)) delete daily[appId];
for (const [date, values] of Object.entries(parsedDaily)) {
  state.daily[date] ||= {};
  state.daily[date][appId] = values;
}
state.changedDatesHighwatermark = "0";

const steam = summarizeSteamState(state, maps.steam);
const generatedAt = new Date().toISOString();
const totals = {
  itch: previousStats.totals.itch,
  steam: steam.totals,
  googlePlay: previousStats.totals.googlePlay,
  combined: { paidUnits: previousStats.totals.itch.purchases + steam.totals.netUnits + previousStats.totals.googlePlay.netPaidAppPurchases },
};
const prior = previousHistory.snapshots.at(-1);
const snapshot = compactSnapshot(generatedAt, totals);
const publicStats = {
  schemaVersion: 1,
  generatedAt,
  totals,
  change: { sincePreviousSnapshot: marketplaceChanges(prior, totals) },
  projects: { ...previousStats.projects, steam: steam.projects },
  futureProviders: previousStats.futureProviders,
};
assertPublicStats(publicStats);
const history = {
  schemaVersion: 1,
  snapshots: equivalentMarketplaceSnapshot(prior, snapshot) ? previousHistory.snapshots : [...previousHistory.snapshots, snapshot],
};
assertHistory(history);

await writeBundle([
  [statePath, JSON.stringify(sanitizeSteamState(state), null, 2) + "\n"],
  [statsPath, JSON.stringify(publicStats, null, 2) + "\n"],
  [historyPath, JSON.stringify(history, null, 2) + "\n"],
]);
console.log(`Imported ${steam.totals.netUnits} sanitised Steam net units across ${Object.keys(parsedDaily).length} report dates.`);

function parseArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
  const csvPath = String(values.get("--csv") || "").trim();
  const appId = String(values.get("--app-id") || "").trim();
  if (!csvPath || !appId || !/^\d+$/.test(appId) || values.size !== 2) {
    throw new Error("Usage: npm run marketplace:import-steam-csv -- --csv <local CSV path> --app-id <Steam app ID>");
  }
  return { csvPath, appId };
}

function compactSnapshot(capturedAt, values) {
  return {
    capturedAt,
    itch: { ...values.itch },
    steam: { netUnits: values.steam.netUnits },
    googlePlay: { netPaidAppPurchases: values.googlePlay.netPaidAppPurchases },
    combined: { ...values.combined },
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeBundle(entries) {
  const temporary = entries.map(([filePath, contents]) => [filePath, `${filePath}.${process.pid}.${Date.now()}.tmp`, contents]);
  await Promise.all(temporary.map(async ([filePath, temporaryPath, contents]) => { await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(temporaryPath, contents, "utf8"); }));
  await Promise.all(temporary.map(([filePath, temporaryPath]) => rename(temporaryPath, filePath)));
}
