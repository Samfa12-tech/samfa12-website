import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corePages = [
  "index.html",
  "404.html",
  "games/index.html",
  "books/index.html",
  "pocket-audio/index.html",
  "apps/index.html",
  "apps/pocket-audio-handoff/index.html",
  "music/index.html",
  "links/index.html",
  "join/index.html",
  "privacy/index.html",
];
const requiredSitemapRoutes = [
  "/",
  "/games/",
  "/games/cursed-cutter/",
  "/books/",
  "/pocket-audio/",
  "/apps/",
  "/apps/what-would-win/",
  "/music/",
  "/links/",
  "/join/",
  "/privacy/",
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
  if (relativePath !== "404.html" && !html.includes("og-image-v2.png")) fail(`${relativePath}: missing current social card`);

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
for (const route of requiredSitemapRoutes) {
  if (!sitemap.includes(`<loc>https://samfa12.com${route}</loc>`)) fail(`sitemap.xml: missing ${route}`);
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

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} issue(s):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Site validation passed for ${corePages.length} core pages and ${hostedAppPages.length} hosted app.`);
