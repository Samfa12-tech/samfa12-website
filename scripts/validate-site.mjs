import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHistory, assertPublicStats } from "./marketplace/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corePages = [
  "index.html",
  "404.html",
  "games/index.html",
  "games/briarhold/index.html",
  "books/index.html",
  "pocket-audio/index.html",
  "apps/index.html",
  "apps/pocket-audio-handoff/index.html",
  "music/index.html",
  "links/index.html",
  "join/index.html",
  "privacy/index.html",
  "stats/index.html",
];
const requiredSitemapRoutes = [
  "/",
  "/games/",
  "/games/cursed-cutter/",
  "/games/briarhold/",
  "/books/",
  "/pocket-audio/",
  "/apps/",
  "/apps/what-would-win/",
  "/music/",
  "/links/",
  "/join/",
  "/privacy/",
  "/stats/",
];
const hostedAppPages = [
  {
    path: "apps/what-would-win/index.html",
    canonical: "https://samfa12.com/apps/what-would-win/",
  },
];
const failures = [];

function fail(message) {
  failures.push(message);
}

function localTarget(sourceFile, rawReference) {
  const reference = rawReference.split(/[?#]/, 1)[0];
  if (!reference || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(rawReference)) return null;
  let target = reference.startsWith("/")
    ? path.join(root, decodeURIComponent(reference.slice(1)))
    : path.resolve(path.dirname(sourceFile), decodeURIComponent(reference));
  if (reference.endsWith("/")) target = path.join(target, "index.html");
  return target;
}

for (const relativePath of corePages) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`${relativePath}: missing core page`);
    continue;
  }
  const html = fs.readFileSync(filePath, "utf8");
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${relativePath}: missing title`);
  if (!/<meta\s+name="description"/i.test(html)) fail(`${relativePath}: missing meta description`);
  if (!/<meta\s+name="viewport"/i.test(html)) fail(`${relativePath}: missing viewport metadata`);
  if (!/<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin"/i.test(html)) {
    fail(`${relativePath}: missing referrer policy metadata`);
  }
  if ((html.match(/<h1\b/gi) || []).length !== 1) fail(`${relativePath}: expected exactly one h1`);
  if (relativePath !== "404.html" && !html.includes('href="/privacy/"')) fail(`${relativePath}: missing privacy link`);
  if (relativePath === "games/briarhold/index.html") {
    if (!html.includes("briarhold-key-art.png")) fail(`${relativePath}: missing Briarhold social card`);
  } else if (relativePath !== "404.html" && !html.includes("og-image-v2.png")) {
    fail(`${relativePath}: missing current social card`);
  }

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    if (ids.filter((value) => value === id).length > 1) fail(`${relativePath}: duplicate id ${id}`);
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gis)) {
    if (!/\balt=["'][^"']*["']/i.test(match[0])) fail(`${relativePath}: image without alt attribute`);
  }
  for (const match of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gis)) {
    if (!/\brel=["'][^"']*(?:noopener|noreferrer)/i.test(match[0])) fail(`${relativePath}: target=_blank link missing safe rel`);
  }
  for (const tag of html.matchAll(/<[^>]+\b(?:href|src)=["']([^"']+)["'][^>]*>/gis)) {
    const target = localTarget(filePath, tag[1]);
    if (target && !fs.existsSync(target)) fail(`${relativePath}: missing local reference ${tag[1]}`);
  }
}

for (const app of hostedAppPages) {
  const filePath = path.join(root, app.path);
  if (!fs.existsSync(filePath)) {
    fail(`${app.path}: missing hosted app shell`);
    continue;
  }
  const html = fs.readFileSync(filePath, "utf8");
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${app.path}: missing title`);
  if (!/<meta\s+name="viewport"/i.test(html)) fail(`${app.path}: missing viewport metadata`);
  if (!html.includes(`<link rel="canonical" href="${app.canonical}"`)) fail(`${app.path}: incorrect canonical URL`);
  if (!html.includes('<div id="root"></div>')) fail(`${app.path}: missing application root mount`);
  if (!html.includes('rel="manifest"')) fail(`${app.path}: missing web app manifest`);
  for (const tag of html.matchAll(/<[^>]+\b(?:href|src)=["']([^"']+)["'][^>]*>/gis)) {
    const target = localTarget(filePath, tag[1]);
    if (target && !fs.existsSync(target)) fail(`${app.path}: missing local reference ${tag[1]}`);
  }
}

const cname = fs.readFileSync(path.join(root, "CNAME"), "utf8").trim();
if (cname !== "samfa12.com") fail(`CNAME must contain only samfa12.com, found ${JSON.stringify(cname)}`);

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const duplicateSitemapLocations = [...new Set(sitemapLocations.filter((location, index) => sitemapLocations.indexOf(location) !== index))];
for (const location of duplicateSitemapLocations) {
  fail(`sitemap.xml: duplicate location ${location}`);
}
for (const route of requiredSitemapRoutes) {
  if (!sitemap.includes(`<loc>https://samfa12.com${route}</loc>`)) fail(`sitemap.xml: missing ${route}`);
}

for (const location of sitemapLocations) {
  const sitePrefix = "https://samfa12.com";
  if (!location.startsWith(sitePrefix)) {
    fail(`sitemap.xml: non-canonical site URL ${location}`);
    continue;
  }
  const route = location.slice(sitePrefix.length);
  const relativePath = route === "/" ? "index.html" : path.join(route.replace(/^\//, ""), "index.html");
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`sitemap.xml: ${route} has no local page`);
    continue;
  }
  const html = fs.readFileSync(filePath, "utf8");
  if (!html.includes(`<link rel="canonical" href="${location}"`)) {
    fail(`${relativePath}: missing or incorrect canonical URL for sitemap route ${route}`);
  }
  if (/<meta\s+name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(html)) {
    fail(`${relativePath}: sitemap route must not be noindex`);
  }
}

const whatWouldWinRoute = path.join(root, "apps", "what-would-win", "index.html");
if (!fs.existsSync(whatWouldWinRoute)) {
  fail("apps/what-would-win/index.html: missing hosted app route");
} else {
  const hosted = fs.readFileSync(whatWouldWinRoute, "utf8");
  if (!/<div\s+id=["']root["']/i.test(hosted)) fail("apps/what-would-win/index.html: missing Vite app root");
  if (!/assets\//i.test(hosted)) fail("apps/what-would-win/index.html: missing built asset reference");
  if (!fs.existsSync(path.join(root, "apps", "what-would-win", "legal-notices.txt"))) fail("apps/what-would-win/legal-notices.txt: missing public licensing notices");
}

try {
  assertPublicStats(JSON.parse(fs.readFileSync(path.join(root, "data", "public-stats.json"), "utf8")));
} catch (error) {
  fail(`data/public-stats.json: ${error.message}`);
}

try {
  assertHistory(JSON.parse(fs.readFileSync(path.join(root, "data", "public-stats-history.json"), "utf8")));
} catch (error) {
  fail(`data/public-stats-history.json: ${error.message}`);
}

const homepageScript = fs.readFileSync(path.join(root, "script.js"), "utf8");
if (!homepageScript.includes("/data/public-stats.json") || !homepageScript.includes("no-store")) {
  fail("script.js: marketplace stats must be fetched with a revalidation-safe request.");
}
if (!homepageScript.includes("/data/public-stats-history.json") || !homepageScript.includes("validateMarketplaceHistory")) {
  fail("script.js: marketplace dashboard must validate its public history feed.");
}
const statsPage = fs.readFileSync(path.join(root, "stats", "index.html"), "utf8");
for (const requiredMarker of ["data-marketplace-dashboard", "data-marketplace-dashboard-unavailable", "data-marketplace-trend", "data-marketplace-projects"]) {
  if (!statsPage.includes(requiredMarker)) fail(`stats/index.html: missing dashboard marker ${requiredMarker}`);
}
const pagesWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "pages.yml"), "utf8");
if (!pagesWorkflow.includes("--exclude='/ops/'")) fail(".github/workflows/pages.yml: ops/ must be excluded from the Pages artifact.");

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} issue(s):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Site validation passed for ${corePages.length} core pages and ${hostedAppPages.length} hosted app.`);
