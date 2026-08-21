import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoSensitivePublicData, loadMarketplaceConfig, newSteamState, projectMappings, sanitizeSteamState, validateItchAndSteamConfig } from "./marketplace/core.mjs";
import { collectItch } from "./marketplace/itch.mjs";
import { collectSteam, getDailySales, summarizeSteamState } from "./marketplace/steam.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadMarketplaceConfig({ cwd: root });
const missing = validateItchAndSteamConfig(config);
if (missing.length) throw new Error(`Marketplace provider verification is incomplete: ${missing.join(", ")}`);

const projects = JSON.parse(await readFile(path.join(root, "data", "projects.json"), "utf8"));
const maps = projectMappings(projects);
const statePath = path.join(root, "ops", "marketplace", "steam-state.json");
const existingState = sanitizeSteamState(await readJsonOr(statePath, newSteamState()));
const steamProbeDate = parseSteamProbeDate(process.env.STEAM_DEBUG_DATE);

// This intentionally performs no writes. The normal three-provider updater is
// the only path that can advance the Steam high-watermark or publish totals.
const [itch, steam, steamProbeDaily] = await Promise.all([
  collectItch({ apiKey: config.itchApiKey, projectNames: maps.itch }),
  collectSteam({ apiKey: config.steamFinancialApiKey, state: existingState, projectNames: maps.steam }),
  steamProbeDate ? getDailySales({ apiKey: config.steamFinancialApiKey, date: steamProbeDate }) : null,
]);
const steamProbe = steamProbeDate ? summarizeSteamState({ ...newSteamState(), daily: { [steamProbeDate]: steamProbeDaily } }, maps.steam) : null;

const report = {
  status: "ok",
  providers: {
    itch: { publishedProjects: itch.projects.length, totals: itch.totals },
    steam: {
      projects: steam.projects.length,
      totals: steam.totals,
      ...(steamProbe && { probe: { date: steamProbeDate, totals: steamProbe.totals } }),
    },
  },
};
assertNoSensitivePublicData(report, "provider verification output");
console.log(JSON.stringify(report));

async function readJsonOr(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function parseSteamProbeDate(value) {
  const date = String(value || "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("STEAM_DEBUG_DATE must be an optional YYYY-MM-DD date.");
  }
  return date;
}
