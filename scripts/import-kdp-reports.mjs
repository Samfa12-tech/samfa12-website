import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHistory, assertPublicStats, equivalentMarketplaceSnapshot, marketplaceChanges } from "./marketplace/core.mjs";
import { amazonProjectTitles, parseKdpWorkbook, summarizeKdpSheets } from "./marketplace/kdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPaths = parseArguments(process.argv.slice(2));
const [projects, previousStats, history, reports] = await Promise.all([
  readJson(path.join(root, "data", "projects.json")),
  readJson(path.join(root, "data", "public-stats.json")),
  readJson(path.join(root, "data", "public-stats-history.json")),
  Promise.all(reportPaths.map((reportPath) => readFile(reportPath))),
]);
assertPublicStats(previousStats);
assertHistory(history);

const amazon = summarizeKdpSheets(reports.map(parseKdpWorkbook), amazonProjectTitles(projects));
const generatedAt = new Date().toISOString();
const totals = {
  ...previousStats.totals,
  amazon: amazon.totals,
  combined: {
    paidUnits: previousStats.totals.itch.purchases + previousStats.totals.steam.netUnits + previousStats.totals.googlePlay.netPaidAppPurchases + amazon.totals.netUnits,
  },
};
const prior = history.snapshots.at(-1);
const snapshot = compactSnapshot(generatedAt, totals);
const publicStats = {
  ...previousStats,
  generatedAt,
  totals,
  change: { sincePreviousSnapshot: marketplaceChanges(prior, totals) },
  projects: { ...previousStats.projects, amazon: amazon.projects },
  futureProviders: (previousStats.futureProviders || []).filter((provider) => provider !== "amazon"),
};
assertPublicStats(publicStats);
const nextHistory = {
  schemaVersion: 1,
  snapshots: equivalentMarketplaceSnapshot(prior, snapshot) ? history.snapshots : [...history.snapshots, snapshot],
};
assertHistory(nextHistory);
await writeBundle([
  [path.join(root, "data", "public-stats.json"), JSON.stringify(publicStats, null, 2) + "\n"],
  [path.join(root, "data", "public-stats-history.json"), JSON.stringify(nextHistory, null, 2) + "\n"],
]);
console.log(`Imported ${amazon.totals.netUnits} sanitised KDP net book units and ${amazon.totals.pagesRead} KENP pages across ${amazon.projects.length} books.`);

function parseArguments(args) {
  const reports = [];
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== "--report" || !args[index + 1]) throw new Error("Usage: npm run marketplace:import-kdp -- --report <KDP report.xlsx> [--report <KDP report.xlsx> ...]");
    reports.push(path.resolve(args[index + 1]));
  }
  if (!reports.length) throw new Error("Usage: npm run marketplace:import-kdp -- --report <KDP report.xlsx> [--report <KDP report.xlsx> ...]");
  return reports;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function compactSnapshot(capturedAt, values) {
  return {
    capturedAt,
    itch: { ...values.itch },
    steam: { netUnits: values.steam.netUnits },
    googlePlay: { netPaidAppPurchases: values.googlePlay.netPaidAppPurchases },
    amazon: { netUnits: values.amazon.netUnits },
    combined: { ...values.combined },
  };
}

async function writeBundle(entries) {
  const temporary = entries.map(([filePath, contents]) => [filePath, `${filePath}.${process.pid}.${Date.now()}.tmp`, contents]);
  await Promise.all(temporary.map(async ([filePath, temporaryPath, contents]) => { await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(temporaryPath, contents, "utf8"); }));
  await Promise.all(temporary.map(([filePath, temporaryPath]) => rename(temporaryPath, filePath)));
}
