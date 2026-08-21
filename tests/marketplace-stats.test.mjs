import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { assertHistory, assertNoSensitivePublicData, assertPublicStats, equivalentMarketplaceSnapshot, marketplaceChanges, newSteamState, parseGooglePlaySalesUri, projectMappings, validateItchAndSteamConfig, validateMarketplaceConfig } from "../scripts/marketplace/core.mjs";
import { collectItch } from "../scripts/marketplace/itch.mjs";
import { applyGooglePlayRow, collectGooglePlay, googlePlayReportListingError, listGooglePlaySalesReports, parseGoogleReportArchive, summarizeGooglePlayOrders } from "../scripts/marketplace/google-play.mjs";
import { collectSteam, describeSteamChangedDatesResponse, summarizeSteamState } from "../scripts/marketplace/steam.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (...parts) => path.join(root, "tests", "fixtures", "marketplace", ...parts);

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

test("itch collector retains only published aggregate counters and strips earnings", async () => {
  const payload = JSON.parse(await readFile(fixture("itch-games.json"), "utf8"));
  const result = await collectItch({
    apiKey: "not-a-real-key",
    projectNames: new Map([["https://samfa12.itch.io/test-orchard", "Mapped orchard"]]),
    fetchImpl: async () => response(payload),
  });
  assert.deepEqual(result.totals, { views: 18, downloads: 9, purchases: 2 });
  assert.deepEqual(result.projects, [{ id: "101", title: "Mapped orchard", url: "https://samfa12.itch.io/test-orchard", views: 18, downloads: 9, purchases: 2 }]);
  assert.doesNotMatch(JSON.stringify(result), /earning/i);
});

test("Steam follows changed-date pages, filters non-package sales and keeps only unit counts", async () => {
  const calls = [];
  const result = await collectSteam({
    apiKey: "not-a-real-key",
    state: newSteamState(),
    projectNames: new Map([["4419290", "Test Steam game"]]),
    fetchImpl: async (url) => {
      const request = new URL(url);
      assert.equal(request.searchParams.get("include_view_grants"), "true");
      calls.push(`${request.pathname}:${request.searchParams.get("date") || ""}:${request.searchParams.get("highwatermark_id") || ""}`);
      if (request.pathname.includes("GetChangedDates")) return response({ response: { dates: ["2026-08-10", "2026-08-11"], result_highwatermark: "21" } });
      if (request.searchParams.get("date") === "2026-08-10" && request.searchParams.get("highwatermark_id") === "0") {
        return response({ response: { sales: [{ line_item_type: "Package", package_sale_type: "Steam", primary_appid: "4419290", gross_units_sold: 3, returned_units: -1, net_units_sold: 2, gross_sales_usd: 999 }], max_id: "5" } });
      }
      if (request.searchParams.get("date") === "2026-08-10") return response({ response: { sales: [], max_id: "5" } });
      return response({ response: { sales: [
        { line_item_type: "Package", package_sale_type: "Retail", primary_appid: "4419290", gross_units_sold: 90, net_units_sold: 90 },
        { line_item_type: "MicroTxn", package_sale_type: "Steam", primary_appid: "4419290", gross_units_sold: 80, net_units_sold: 80 },
        { line_item_type: "Package", package_sale_type: "Steam", primary_appid: "4419290", gross_units_sold: 1, returned_units: 0, net_units_sold: 1 },
      ], max_id: "0" } });
    },
  });
  assert.equal(result.state.changedDatesHighwatermark, "21");
  assert.deepEqual(result.totals, { grossUnits: 4, returnedUnits: 1, netUnits: 3 });
  assert.equal(result.projects[0].title, "Test Steam game");
  assert.ok(calls.some((call) => call.endsWith(":2026-08-10:5")), "expected detail pagination");
  assert.doesNotMatch(JSON.stringify(result.state), /sales_usd|financial|price/i);
});

test("Steam re-reported dates replace their complete stored aggregate", async () => {
  const state = { schemaVersion: 1, changedDatesHighwatermark: "21", daily: { "2026-08-10": { "4419290": { grossUnits: 3, returnedUnits: 1, netUnits: 2 } }, "2026-08-11": { "4419290": { grossUnits: 1, returnedUnits: 0, netUnits: 1 } } } };
  const result = await collectSteam({
    apiKey: "not-a-real-key", state,
    fetchImpl: async (url) => {
      const request = new URL(url);
      assert.equal(request.searchParams.get("include_view_grants"), "true");
      if (request.pathname.includes("GetChangedDates")) return response({ response: { dates: ["2026-08-10"], result_highwatermark: "22" } });
      return response({ response: { sales: [{ line_item_type: "Package", package_sale_type: "Steam", primary_appid: "4419290", gross_units_sold: 1, returned_units: 0, net_units_sold: 1 }], max_id: "0" } });
    },
  });
  assert.deepEqual(result.state.daily["2026-08-10"]["4419290"], { grossUnits: 1, returnedUnits: 0, netUnits: 1 });
  assert.deepEqual(result.totals, { grossUnits: 2, returnedUnits: 0, netUnits: 2 });
});

test("Steam changed-date diagnostics report only response shape, never provider values", () => {
  const diagnostic = describeSteamChangedDatesResponse({ response: { error: "account 12345 is not authorised", message: "key=not-for-logs" } });
  assert.equal(diagnostic, "nested response; dates missing; highwatermark missing; provider error fields error,message");
  assert.doesNotMatch(diagnostic, /12345|not-for-logs/);
  assert.equal(describeSteamChangedDatesResponse({ response: { dates: [], result_highwatermark: "8" } }), "nested response; dates array; highwatermark present; provider error fields none");
});

test("Google Play handles header-based multi-report charges, refunds, partial refunds, and never persists order IDs", async () => {
  const august = await readFile(fixture("google-play-202608.csv"), "utf8");
  const september = await readFile(fixture("google-play-202609.csv"), "utf8");
  const rows = parseGoogleReportArchive(zipSync({ "salesreport_202608.csv": strToU8(august), "salesreport_202609.csv": strToU8(september) }));
  const orders = new Map();
  rows.forEach((row) => applyGooglePlayRow(orders, row));
  const result = summarizeGooglePlayOrders(orders, new Map([["com.samsmall.drink", "Drink"]]));
  assert.deepEqual(result.totals, { grossPaidAppPurchases: 4, fullyRefundedPaidAppOrders: 1, netPaidAppPurchases: 3 });
  assert.equal(result.projects.find((project) => project.packageId === "com.samsmall.samfa12tdpack").netPaidAppPurchases, 1, "partial refund does not subtract an app unit");
  assert.doesNotMatch(JSON.stringify(result), /TEST-ORDER|currency|amount/i);
});

test("Google Play lists every historical monthly ZIP under the configured sales prefix", async () => {
  const august = await readFile(fixture("google-play-202608.csv"), "utf8");
  const september = await readFile(fixture("google-play-202609.csv"), "utf8");
  const archive = (name, csv) => ({ name, download: async () => [zipSync({ "report.csv": strToU8(csv) })] });
  const storage = { bucket: (bucket) => ({ getFiles: async ({ prefix }) => {
    assert.equal(bucket, "pubsite_prod_rev_123456");
    assert.equal(prefix, "sales/");
    return [[archive("sales/salesreport_202608.zip", august), archive("sales/salesreport_202609.zip", september)]];
  } }) };
  const result = await collectGooglePlay({ salesUri: "gs://pubsite_prod_rev_123456/sales/", storage });
  assert.equal(result.totals.netPaidAppPurchases, 3);
});

test("Google Play accepts the Console bucket URI and derives its sales report prefix", () => {
  assert.deepEqual(parseGooglePlaySalesUri("gs://pubsite_prod_rev_123456"), { bucket: "pubsite_prod_rev_123456", prefix: "sales/" });
  assert.deepEqual(parseGooglePlaySalesUri("gs://pubsite_prod_rev_123456/sales/"), { bucket: "pubsite_prod_rev_123456", prefix: "sales/" });
  assert.deepEqual(parseGooglePlaySalesUri("gs://pubsite_prod_123456/sales/"), { bucket: "pubsite_prod_123456", prefix: "sales/" });
});

test("Google Play configuration rejects missing, non-Play, and non-sales report URIs", () => {
  const complete = { itchApiKey: "itch", steamFinancialApiKey: "steam", googlePlayServiceAccountJson: "{}", googlePlayServiceAccountJsonPath: "" };
  assert.equal(parseGooglePlaySalesUri(""), null);
  assert.equal(parseGooglePlaySalesUri("gs://unrelated-bucket/sales/"), null);
  assert.equal(parseGooglePlaySalesUri("gs://pubsite_prod_rev_123456/earnings/"), null);
  assert.match(validateMarketplaceConfig({ ...complete, googlePlaySalesUri: "" }).join(", "), /GOOGLE_PLAY_SALES_URI/);
  assert.match(validateMarketplaceConfig({ ...complete, googlePlaySalesUri: "gs://unrelated-bucket/sales/" }).join(", "), /GOOGLE_PLAY_SALES_URI/);
});

test("Google Play report enumeration returns matching reports and sanitises storage list denial", async () => {
  const report = { name: "sales/salesreport_202608.zip" };
  const storage = { bucket: (bucket) => ({ getFiles: async ({ prefix }) => {
    assert.equal(bucket, "pubsite_prod_rev_123456");
    assert.equal(prefix, "sales/");
    return [[report, { name: "sales/estimatedsalesreport_202608.zip" }]];
  } }) };
  assert.deepEqual(await listGooglePlaySalesReports({ salesUri: "gs://pubsite_prod_rev_123456", storage }), [report]);
  const deniedStorage = { bucket: () => ({ getFiles: async () => { throw { code: 403, message: "samfa12-marketplace-reporting@example.com cannot list gs://pubsite_prod_rev_secret/sales/" }; } }) };
  await assert.rejects(
    listGooglePlaySalesReports({ salesUri: "gs://pubsite_prod_rev_123456", storage: deniedStorage }),
    (error) => {
      assert.match(error.message, /storage\.objects\.list/);
      assert.match(error.message, /View app information and download bulk reports/);
      assert.doesNotMatch(error.message, /example\.com|pubsite_prod_rev_secret/);
      return true;
    },
  );
  assert.match(googlePlayReportListingError({ code: 403 }).message, /Global/);
});

test("public schema privacy guard and snapshots accept legitimate negative weekly movement while rejecting financial data", () => {
  const stats = {
    schemaVersion: 1,
    generatedAt: "2026-08-17T00:00:00.000Z",
    totals: { itch: { views: 2, downloads: 1, purchases: 1 }, steam: { grossUnits: 1, returnedUnits: 0, netUnits: 1 }, googlePlay: { grossPaidAppPurchases: 1, fullyRefundedPaidAppOrders: 0, netPaidAppPurchases: 1 }, combined: { paidUnits: 3 } },
    change: { sincePreviousSnapshot: { itch: { views: 0, downloads: 0, purchases: 0 }, steam: { netUnits: -1 }, googlePlay: { netPaidAppPurchases: 0 }, combined: { paidUnits: -1 } } },
    projects: { itch: [], steam: [], googlePlay: [] }, futureProviders: ["amazon"],
  };
  assert.equal(assertPublicStats(stats), stats);
  assert.equal(assertHistory({ schemaVersion: 1, snapshots: [{ capturedAt: "2026-08-10T00:00:00.000Z", itch: { views: 1, downloads: 1, purchases: 1 }, steam: { netUnits: 2 }, googlePlay: { netPaidAppPurchases: 1 }, combined: { paidUnits: 4 } }] }).schemaVersion, 1);
  assert.throws(() => assertNoSensitivePublicData({ project: { orderNumber: "TEST-ORDER-001" } }), /prohibited/i);
  assert.throws(() => assertNoSensitivePublicData({ project: { earnings: 7 } }), /prohibited/i);
  assert.throws(() => assertNoSensitivePublicData({ project: { price: 7 } }), /prohibited/i);
});

test("aggregation calculates positive, zero, and negative deltas without duplicate history results", () => {
  const totals = { itch: { views: 12, downloads: 4, purchases: 2 }, steam: { grossUnits: 3, returnedUnits: 0, netUnits: 3 }, googlePlay: { grossPaidAppPurchases: 1, fullyRefundedPaidAppOrders: 0, netPaidAppPurchases: 1 }, combined: { paidUnits: 6 } };
  const previous = { capturedAt: "2026-08-10T00:00:00.000Z", itch: { views: 7, downloads: 4, purchases: 2 }, steam: { netUnits: 4 }, googlePlay: { netPaidAppPurchases: 1 }, combined: { paidUnits: 7 } };
  assert.deepEqual(marketplaceChanges(previous, totals), { itch: { views: 5, downloads: 0, purchases: 0 }, steam: { netUnits: -1 }, googlePlay: { netPaidAppPurchases: 0 }, combined: { paidUnits: -1 } });
  const matching = { capturedAt: "2026-08-17T00:00:00.000Z", ...previous, capturedAt: "2026-08-17T00:00:00.000Z" };
  assert.equal(equivalentMarketplaceSnapshot(previous, matching), true);
});

test("catalogue URL mappings use current project data instead of duplicated titles", () => {
  const projects = [{ title: "Drink", links: [
    { url: "https://samfa12.itch.io/drink" },
    { url: "https://store.steampowered.com/app/4419290/Drink/" },
    { url: "https://play.google.com/store/apps/details?id=com.samsmall.drink" },
  ] }];
  const mappings = projectMappings(projects);
  assert.equal(mappings.itch.get("https://samfa12.itch.io/drink"), "Drink");
  assert.equal(mappings.steam.get("4419290"), "Drink");
  assert.equal(mappings.googlePlay.get("com.samsmall.drink"), "Drink");
  assert.deepEqual(summarizeSteamState({ schemaVersion: 1, changedDatesHighwatermark: "0", daily: {} }).totals, { grossUnits: 0, returnedUnits: 0, netUnits: 0 });
});

test("Google Play pack listings are not relabelled as an included featured scene", () => {
  const mappings = projectMappings([
    { title: "Samfa12's Lofi and Chill Pack", links: [{ label: "Get it on Google Play", url: "https://play.google.com/store/apps/details?id=com.samfa12.lofiandchillpack" }] },
    { title: "Pocket Ant Farm", links: [{ label: "Featured in Samfa12's Lofi and Chill Pack", url: "https://play.google.com/store/apps/details?id=com.samfa12.lofiandchillpack" }] },
  ]);
  assert.equal(mappings.googlePlay.get("com.samfa12.lofiandchillpack"), "Samfa12's Lofi and Chill Pack");
});

test("provider-only verification requires only itch and Steam credentials", () => {
  assert.deepEqual(validateItchAndSteamConfig({ itchApiKey: "itch", steamFinancialApiKey: "steam" }), []);
  assert.deepEqual(validateItchAndSteamConfig({ itchApiKey: "", steamFinancialApiKey: "steam" }), ["ITCH_API_KEY"]);
  assert.deepEqual(validateItchAndSteamConfig({ itchApiKey: "itch", steamFinancialApiKey: "" }), ["STEAM_FINANCIAL_API_KEY"]);
});
