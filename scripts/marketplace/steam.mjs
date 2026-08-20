import { finiteInteger, newSteamState, nonNegativeInteger, requestJson, sanitizeSteamState } from "./core.mjs";

const BASE_URL = "https://partner.steam-api.com/IPartnerFinancialsService";

export async function collectSteam({ apiKey, state, projectNames = new Map(), fetchImpl = fetch }) {
  const current = sanitizeSteamState(state);
  const changed = await getChangedDates({ apiKey, highwatermark: current.changedDatesHighwatermark, fetchImpl });
  const next = sanitizeSteamState(current);
  for (const date of changed.dates) next.daily[date] = await getDailySales({ apiKey, date, fetchImpl });
  next.changedDatesHighwatermark = String(changed.highwatermark);
  return { state: next, ...summarizeSteamState(next, projectNames) };
}

export async function getChangedDates({ apiKey, highwatermark = "0", fetchImpl = fetch }) {
  const url = new URL(`${BASE_URL}/GetChangedDatesForPartner/v001/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("highwatermark", String(highwatermark));
  const payload = await requestJson({ fetchImpl, url, label: "Steam changed dates" });
  const response = payload.response || payload;
  const dates = response.dates || response.changed_dates || response.changedDates;
  const resultHighwatermark = response.result_highwatermark ?? response.resultHighwatermark;
  if (!Array.isArray(dates) || resultHighwatermark === undefined || resultHighwatermark === null) {
    throw new Error("Steam changed dates returned an unexpected response.");
  }
  return { dates: [...new Set(dates.map(normalizeDate).filter(Boolean))], highwatermark: String(resultHighwatermark) };
}

export async function getDailySales({ apiKey, date, fetchImpl = fetch }) {
  let highwatermarkId = "0";
  const totals = new Map();
  for (let page = 0; page < 10_000; page += 1) {
    const url = new URL(`${BASE_URL}/GetDetailedSales/v001/`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("date", date);
    url.searchParams.set("highwatermark_id", highwatermarkId);
    const payload = await requestJson({ fetchImpl, url, label: "Steam detailed sales" });
    const response = payload.response || payload;
    const rows = response.sales || response.rows || response.results || response.detailed_sales;
    const maxId = response.max_id ?? response.maxId;
    if (!Array.isArray(rows) || maxId === undefined || maxId === null) throw new Error(`Steam detailed sales returned an unexpected response for ${date}.`);
    mergeSalesRows(totals, rows);
    if (String(maxId) === String(highwatermarkId)) return mapToObject(totals);
    highwatermarkId = String(maxId);
  }
  throw new Error(`Steam detailed sales pagination did not complete for ${date}.`);
}

export function summarizeSteamState(state, projectNames = new Map()) {
  const totalsByApp = new Map();
  for (const daily of Object.values(state.daily || {})) {
    for (const [appId, values] of Object.entries(daily || {})) {
      const current = totalsByApp.get(appId) || { grossUnits: 0, returnedUnits: 0, netUnits: 0 };
      current.grossUnits += nonNegativeInteger(values.grossUnits);
      current.returnedUnits += nonNegativeInteger(values.returnedUnits);
      current.netUnits += finiteInteger(values.netUnits);
      totalsByApp.set(appId, current);
    }
  }
  const projects = [...totalsByApp.entries()].map(([appId, values]) => ({
    appId,
    title: projectNames.get(appId) || `Steam app ${appId}`,
    ...values,
  })).sort((a, b) => a.title.localeCompare(b.title));
  return {
    totals: projects.reduce((total, project) => ({
      grossUnits: total.grossUnits + project.grossUnits,
      returnedUnits: total.returnedUnits + project.returnedUnits,
      netUnits: total.netUnits + project.netUnits,
    }), { grossUnits: 0, returnedUnits: 0, netUnits: 0 }),
    projects,
  };
}

export function mergeSalesRows(totals, rows) {
  for (const row of rows) {
    if (String(field(row, "line_item_type", "lineItemType")).toLowerCase() !== "package") continue;
    if (String(field(row, "package_sale_type", "packageSaleType")).toLowerCase() !== "steam") continue;
    const appId = String(field(row, "primary_appid", "primaryAppid", "primaryAppId") || "");
    if (!/^\d+$/.test(appId)) continue;
    const current = totals.get(appId) || { grossUnits: 0, returnedUnits: 0, netUnits: 0 };
    current.grossUnits += nonNegativeInteger(field(row, "gross_units_sold", "grossUnitsSold", "gross_units"));
    current.returnedUnits += Math.abs(Number(field(row, "returned_units", "returnedUnits", "return_units", "refunded_units")) || 0);
    current.netUnits += finiteInteger(field(row, "net_units_sold", "netUnitsSold", "net_units"));
    totals.set(appId, current);
  }
}

function field(row, ...names) {
  for (const name of names) if (row?.[name] !== undefined) return row[name];
  return undefined;
}

function mapToObject(values) {
  return Object.fromEntries([...values.entries()].map(([appId, count]) => [appId, {
    grossUnits: nonNegativeInteger(count.grossUnits),
    returnedUnits: nonNegativeInteger(count.returnedUnits),
    netUnits: finiteInteger(count.netUnits),
  }]));
}

function normalizeDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}
