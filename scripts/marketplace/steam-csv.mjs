import { parse } from "csv-parse/sync";

export function parseSteamSalesCsv(source) {
  const lines = String(source || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("Date,"));
  if (headerIndex < 0) throw new Error("Steam CSV is missing its expected Date header.");
  const rows = parse(lines.slice(headerIndex).join("\n"), { columns: true, skip_empty_lines: true, trim: true });
  const daily = {};
  for (const row of rows) {
    if (String(row.Type || "").trim() !== "Steam") continue;
    const date = normalizeDate(row.Date);
    if (!date) throw new Error("Steam CSV contains an invalid Steam sale date.");
    const current = daily[date] || { grossUnits: 0, returnedUnits: 0, netUnits: 0 };
    current.grossUnits += nonNegativeInteger(row["Gross Units Sold"]);
    current.returnedUnits += Math.abs(integer(row["Chargeback/Returns"]));
    current.netUnits += integer(row["Net Units Sold"]);
    daily[date] = current;
  }
  if (!Object.keys(daily).length) throw new Error("Steam CSV contains no direct Steam package sales.");
  return daily;
}

function normalizeDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function integer(value) {
  const parsed = Number(String(value || "").trim());
  if (!Number.isInteger(parsed)) throw new Error("Steam CSV contains a non-integer unit count.");
  return parsed;
}

function nonNegativeInteger(value) {
  return Math.max(0, integer(value));
}
