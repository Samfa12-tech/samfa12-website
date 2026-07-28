import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalyticsReport,
  collectClarity,
  collectCloudflare,
  normalizeCloudflareDaily,
  normalizeCloudflarePaths,
} from "../scripts/analytics-core.mjs";

test("Cloudflare rows are normalized into daily traffic and public page paths", () => {
  assert.deepEqual(normalizeCloudflareDaily([
    { count: 10, sum: { visits: 4 }, dimensions: { datetimeHour: "2026-07-27T01:00:00Z" } },
    { count: 8, sum: { visits: 3 }, dimensions: { datetimeHour: "2026-07-27T02:00:00Z" } },
    { count: 5, sum: { visits: 2 }, dimensions: { datetimeHour: "2026-07-28T01:00:00Z" } },
  ]), [
    { date: "2026-07-27", requests: 18, visits: 7 },
    { date: "2026-07-28", requests: 5, visits: 2 },
  ]);

  assert.deepEqual(normalizeCloudflarePaths([
    { count: 50, sum: { visits: 10 }, dimensions: { clientRequestPath: "/script.js?v=1" } },
    { count: 20, sum: { visits: 12 }, dimensions: { clientRequestPath: "/games/" } },
    { count: 15, sum: { visits: 9 }, dimensions: { clientRequestPath: "/index.html?campaign=test" } },
    { count: 5, sum: { visits: 1 }, dimensions: { clientRequestPath: "/cdn-cgi/rum" } },
  ]), [
    { path: "/games/", requests: 20, visits: 12 },
    { path: "/index.html", requests: 15, visits: 9 },
  ]);
});

test("Clarity collection strips URL query strings from aggregate exports", async () => {
  const fetchImpl = async () => new Response(JSON.stringify([
    {
      metricName: "Dead Click Count",
      information: [{
        URL: "https://samfa12.com/games/?private=test#section",
        deadClickCount: "2",
        Device: "Mobile",
      }],
    },
  ]), { status: 200, headers: { "content-type": "application/json" } });

  const result = await collectClarity({ apiToken: "test-token", fetchImpl });
  assert.equal(result.metrics[0].information[0].URL, "/games/");
});

test("Cloudflare collection resolves a zone and normalizes GraphQL data", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/zones?")) {
      return new Response(JSON.stringify({
        success: true,
        result: [{ id: "zone-123", name: "samfa12.com" }],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: {
        viewer: {
          zones: [{
            daily: [{ count: 10, sum: { visits: 4 }, dimensions: { datetimeHour: "2026-07-28T01:00:00Z" } }],
            topPaths: [{ count: 10, sum: { visits: 4 }, dimensions: { clientRequestPath: "/" } }],
            devices: [{ count: 10, sum: { visits: 4 }, dimensions: { clientDeviceType: "mobile" } }],
            statuses: [{ count: 10, dimensions: { edgeResponseStatus: 200 } }],
          }],
        },
      },
      errors: null,
    }), { status: 200 });
  };

  const result = await collectCloudflare({
    apiToken: "test-token",
    hostname: "samfa12.com",
    lookbackDays: 1,
    now: new Date("2026-07-28T12:00:00Z"),
    fetchImpl,
  });

  assert.equal(result.zoneId, "zone-123");
  assert.deepEqual(result.daily, [{ date: "2026-07-28", requests: 10, visits: 4 }]);
  assert.equal(calls.length, 2);
});

test("Report compares periods and turns friction signals into suggestions", () => {
  const daily = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-07-${String(index + 14).padStart(2, "0")}`,
    visits: index < 7 ? 10 : 20,
    requests: index < 7 ? 30 : 60,
  }));
  const report = buildAnalyticsReport([{
    capturedAt: "2026-07-28T12:00:00Z",
    cloudflare: {
      daily,
      topPaths: [{ path: "/games/", visits: 20, requests: 60 }],
      devices: [{ device: "mobile", visits: 20, requests: 60 }],
      statuses: [{ status: "2xx", requests: 60 }],
    },
    clarity: {
      metrics: [{
        metricName: "Rage Click Count",
        information: [{ rageClickCount: "3", URL: "/games/" }],
      }],
    },
  }], { generatedAt: new Date("2026-07-28T12:30:00Z") });

  assert.match(report, /Visits: up 100\.0%/);
  assert.match(report, /Review the URLs producing rage clicks/);
  assert.doesNotMatch(report, /private=/);
});

test("Clarity retries a transient network failure without exposing credentials", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary reset");
    return new Response("[]", { status: 200 });
  };

  const result = await collectClarity({ apiToken: "test-token", fetchImpl });
  assert.equal(attempts, 2);
  assert.deepEqual(result.metrics, []);
});

test("Report keeps the fullest daily totals when rolling snapshots overlap", () => {
  const report = buildAnalyticsReport([
    {
      capturedAt: "2026-07-27T08:00:00Z",
      cloudflare: { daily: [{ date: "2026-07-26", visits: 10, requests: 20 }] },
      clarity: { metrics: [] },
    },
    {
      capturedAt: "2026-07-28T08:00:00Z",
      cloudflare: {
        daily: [
          { date: "2026-07-26", visits: 5, requests: 12 },
          { date: "2026-07-27", visits: 3, requests: 6 },
        ],
      },
      clarity: { metrics: [] },
    },
  ], { generatedAt: new Date("2026-07-28T09:00:00Z") });

  assert.match(report, /\| Latest 2 days \| 13 \| 26 \|/);
});
