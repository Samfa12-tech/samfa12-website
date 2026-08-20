import { canonicalUrl, nonNegativeInteger, requestJson } from "./core.mjs";

const ENDPOINT = "https://api.itch.io/profile/games";

export async function collectItch({ apiKey, projectNames = new Map(), fetchImpl = fetch }) {
  const payload = await requestJson({
    fetchImpl,
    url: ENDPOINT,
    label: "itch.io",
    options: { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
  });
  const games = Array.isArray(payload.games) ? payload.games : Array.isArray(payload) ? payload : null;
  if (!games) throw new Error("itch.io returned an unexpected games response.");
  const projects = games
    .filter((game) => game && game.published !== false && game.published !== null)
    .map((game) => {
      const url = safeItchUrl(game.url);
      return {
        id: String(game.id ?? ""),
        title: projectNames.get(url) || String(game.title || "Untitled itch project"),
        url,
        views: nonNegativeInteger(game.views_count),
        downloads: nonNegativeInteger(game.downloads_count),
        purchases: nonNegativeInteger(game.purchases_count),
      };
    })
    .filter((game) => game.id && game.url)
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    totals: projects.reduce((totals, game) => ({
      views: totals.views + game.views,
      downloads: totals.downloads + game.downloads,
      purchases: totals.purchases + game.purchases,
    }), { views: 0, downloads: 0, purchases: 0 }),
    projects,
  };
}

function safeItchUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("itch.io") ? canonicalUrl(url) : "";
  } catch {
    return "";
  }
}
