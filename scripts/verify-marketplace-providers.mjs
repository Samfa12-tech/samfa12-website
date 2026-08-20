import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoSensitivePublicData, loadMarketplaceConfig, newSteamState, projectMappings, sanitizeSteamState, validateItchAndSteamConfig } from "./marketplace/core.mjs";
import { collectItch } from "./marketplace/itch.mjs";
import { collectSteam } from "./marketplace/steam.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadMarketplaceConfig({ cwd: root });
const missing = validateItchAndSteamConfig(config);
if (missing.length) throw new Error(`Marketplace provider verification is incomplete: ${missing.join(", ")}`);

const projects = JSON.parse(await readFile(path.join(root, "data", "projects.json"), "utf8"));
const maps = projectMappings(projects);
const statePath = path.join(root, "ops", "marketplace", "steam-state.json");
const existingState = sanitizeSteamState(await readJsonOr(statePath, newSteamState()));

// This intentionally performs no writes. The normal three-provider updater is
// the only path that can advance the Steam high-watermark or publish totals.
const [itch, steam] = await Promise.all([
  collectItch({ apiKey: config.itchApiKey, projectNames: maps.itch }),
  collectSteam({ apiKey: config.steamFinancialApiKey, state: existingState, projectNames: maps.steam }),
]);

const report = {
  status: "ok",
  providers: {
    itch: { publishedProjects: itch.projects.length, totals: itch.totals },
    steam: { projects: steam.projects.length, totals: steam.totals },
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
