import { Storage } from "@google-cloud/storage";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
import { GOOGLE_PLAY_READ_ONLY_SCOPE, nonNegativeInteger, parseGooglePlaySalesUri } from "./core.mjs";

export async function collectGooglePlay({ serviceAccountJson, serviceAccountJsonPath, salesUri, projectNames = new Map(), storage } = {}) {
  const reports = await listGooglePlaySalesReports({ serviceAccountJson, serviceAccountJsonPath, salesUri, storage });
  const orderMap = new Map();
  for (const file of reports) {
    const [archive] = await file.download();
    for (const row of parseGoogleReportArchive(archive)) applyGooglePlayRow(orderMap, row);
  }
  return summarizeGooglePlayOrders(orderMap, projectNames);
}

export async function verifyGooglePlaySalesAccess(options = {}) {
  await listGooglePlaySalesReports(options);
}

export async function listGooglePlaySalesReports({ serviceAccountJson, serviceAccountJsonPath, salesUri, storage } = {}) {
  const location = parseGooglePlaySalesUri(salesUri);
  if (!location) throw new Error("Google Play sales URI must be the Financial report gs://pubsite_prod_rev_... URI copied from Play Console.");
  const client = storage || await createStorage({ serviceAccountJson, serviceAccountJsonPath });
  let files;
  try {
    [files] = await client.bucket(location.bucket).getFiles({ prefix: location.prefix });
  } catch (error) {
    throw googlePlayReportListingError(error);
  }
  const reports = files.filter((file) => new RegExp(`^${escapeRegExp(location.prefix)}salesreport_\\d{6}\\.zip$`, "i").test(file.name));
  if (!reports.length) throw new Error("Google Play returned no historical sales reports.");
  return reports.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createStorage({ serviceAccountJson, serviceAccountJsonPath }) {
  let source = serviceAccountJson;
  if (!source && serviceAccountJsonPath) source = await readFile(serviceAccountJsonPath, "utf8");
  if (!source) throw new Error("Google Play service-account credentials are unavailable.");
  let credentials;
  try {
    credentials = JSON.parse(source);
  } catch {
    throw new Error("Google Play service-account JSON is malformed.");
  }
  return new Storage({ credentials, scopes: [GOOGLE_PLAY_READ_ONLY_SCOPE] });
}

export function parseGoogleReportArchive(bytes) {
  let contents;
  try {
    contents = unzipSync(new Uint8Array(bytes));
  } catch {
    throw new Error("Google Play sales report ZIP could not be read.");
  }
  const rows = [];
  for (const [name, content] of Object.entries(contents)) {
    if (!/\.csv$/i.test(name)) continue;
    try {
      rows.push(...parse(new TextDecoder().decode(content), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true, trim: true }));
    } catch {
      throw new Error("Google Play sales report CSV could not be parsed.");
    }
  }
  if (!rows.length && !Object.keys(contents).some((name) => /\.csv$/i.test(name))) throw new Error("Google Play sales report ZIP contains no CSV file.");
  return rows;
}

export function applyGooglePlayRow(orderMap, row) {
  const productType = normalise(row["Product Type"]);
  if (productType !== "paid app") return;
  const orderNumber = String(row["Order Number"] || "").trim();
  const packageId = String(row["Package ID"] || "").trim();
  const status = normalise(row["Financial Status"]);
  if (!orderNumber || !packageId || !status) return;
  const order = orderMap.get(orderNumber) || { packageId, charged: false, fullyRefunded: false, partialRefunded: false };
  order.packageId = packageId;
  if (status === "charged") order.charged = true;
  if (status === "refund" || status === "refunded") order.fullyRefunded = true;
  if (status === "partial refund" || status === "partially refunded") order.partialRefunded = true;
  orderMap.set(orderNumber, order);
}

export function summarizeGooglePlayOrders(orderMap, projectNames = new Map()) {
  const byPackage = new Map();
  for (const order of orderMap.values()) {
    if (!order.charged) continue;
    const current = byPackage.get(order.packageId) || { grossPaidAppPurchases: 0, fullyRefundedPaidAppOrders: 0, netPaidAppPurchases: 0 };
    current.grossPaidAppPurchases += 1;
    if (order.fullyRefunded) current.fullyRefundedPaidAppOrders += 1;
    else current.netPaidAppPurchases += 1;
    byPackage.set(order.packageId, current);
  }
  const projects = [...byPackage.entries()].map(([packageId, counts]) => ({
    packageId,
    title: projectNames.get(packageId) || packageId,
    ...counts,
  })).sort((a, b) => a.title.localeCompare(b.title));
  return {
    totals: projects.reduce((total, project) => ({
      grossPaidAppPurchases: total.grossPaidAppPurchases + project.grossPaidAppPurchases,
      fullyRefundedPaidAppOrders: total.fullyRefundedPaidAppOrders + project.fullyRefundedPaidAppOrders,
      netPaidAppPurchases: total.netPaidAppPurchases + project.netPaidAppPurchases,
    }), { grossPaidAppPurchases: 0, fullyRefundedPaidAppOrders: 0, netPaidAppPurchases: 0 }),
    projects,
  };
}

function normalise(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function googlePlayReportListingError(error) {
  const code = Number(error?.code);
  const message = String(error?.message || "");
  if (code === 403 || /(?:HTTP\\s*)?403|storage\.objects\.list/i.test(message)) {
    return new Error("Google Play report listing was denied (storage.objects.list). Verify the exact Cloud Storage URI copied from Play Console > Download reports > Financial; invite the service account in Play Console; and grant Global 'View app information and download bulk reports (read-only)' plus Global 'View financial data, orders, and cancellation survey responses'.");
  }
  return new Error("Google Play sales report enumeration failed. Check the Play Console reporting URI and service-account access.");
}
