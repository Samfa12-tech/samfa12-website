import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brokenHostedEntrypoints } from "./hosted-entrypoints.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.resolve(process.env.SEO_SITE_ROOT || root);
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data/projects.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "content/manifest.json"), "utf8"));
const errors = [];
const read = (relative) => fs.readFileSync(path.join(siteRoot, relative), "utf8");
const has = (relative) => fs.existsSync(path.join(siteRoot, relative));
const routeFile = (route) => route === "/" ? "index.html" : `${route.slice(1)}index.html`;
function fail(message) { errors.push(message); }
function page(route) {
  const relative = routeFile(route);
  if (!has(relative)) { fail(`${route}: missing page`); return null; }
  return read(relative);
}
function canonical(html, route) {
  const expected = `https://samfa12.com${route}`;
  if ((html.match(/<link\s+rel="canonical"/gi) || []).length !== 1 || !html.includes(`<link rel="canonical" href="${expected}"`)) fail(`${route}: wrong or duplicate canonical`);
  if (/<meta\s+name="robots"[^>]*noindex/i.test(html)) fail(`${route}: indexable page is noindex`);
}
function localRefs(html, route) {
  for (const match of html.matchAll(/<(?:a|img|script|link)\b[^>]*\b(?:href|src)="([^"]*)"/gi)) {
    const reference = match[1];
    if (!reference || reference.startsWith("#") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
    const raw = reference.split(/[?#]/,1)[0];
    if (raw.includes("..") || raw.includes("\\")) { fail(`${route}: unsafe local URL ${reference}`); continue; }
    const destination = new URL(reference, `https://samfa12.com${route}`).pathname;
    const relative = destination.endsWith("/") ? `${destination.slice(1)}index.html` : destination.slice(1);
    if (!has(relative)) fail(`${route}: broken local URL ${reference}`);
  }
  for (const match of html.matchAll(/<a\b[^>]*\bhref="(#[^"]+|\/[^"]*#[^"]+)"/gi)) {
    const [pathname,fragment] = match[1].split("#",2);
    if (!fragment) continue;
    const targetRoute = pathname || route;
    const targetFile = routeFile(targetRoute.split("?",1)[0]);
    if (!has(targetFile)) { fail(`${route}: missing fragment page ${targetRoute}`); continue; }
    const targetHtml = pathname ? read(targetFile) : html;
    if (!targetHtml.includes(`id="${fragment}"`) && !targetHtml.includes(`id='${fragment}'`)) fail(`${route}: missing fragment ${match[1]}`);
  }
}
function jsonGraphs(html, route) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) fail(`${route}: missing JSON-LD`);
  for (const block of blocks) {
    try { JSON.parse(block[1]); } catch (error) { fail(`${route}: invalid JSON-LD: ${error.message}`); }
  }
}

const ids = new Set();
const routes = new Set();
const pageTitles = new Set();
const pageDescriptions = new Set();
for (const record of catalogue) {
  if (!record.id || ids.has(record.id)) fail(`catalogue: duplicate or missing ID ${record.id}`);
  ids.add(record.id);
}
if (catalogue.length !== manifest.products.length + manifest.directories.length) fail("catalogue: missing disposition");
const dustGame = catalogue.find((p) => p.id === "game-dust-on-the-river");
const dustBook = catalogue.find((p) => p.id === "book-dust-on-the-river");
if (!dustGame || !dustBook || dustGame.category === dustBook.category) fail("catalogue: Dust game and book identities are not separate");
for (const plan of manifest.products) {
  const record = catalogue.find((item) => item.id === plan.id);
  if (!record) { fail(`manifest: missing ${plan.id}`); continue; }
  if (plan.action === "hold") {
    if (record.detailUrl) fail(`${plan.id}: held product has an indexable detail URL`);
    continue;
  }
  if (record.detailUrl !== plan.path) fail(`${plan.id}: detail URL mismatch`);
  if (routes.has(plan.path.toLowerCase())) fail(`manifest: duplicate route ${plan.path}`);
  routes.add(plan.path.toLowerCase());
  const html = page(plan.path);
  if (!html) continue;
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const pageDescription = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  if (!pageTitle || pageTitles.has(pageTitle)) fail(`${plan.path}: missing or duplicate page title`);
  if (!pageDescription || pageDescriptions.has(pageDescription)) fail(`${plan.path}: missing or duplicate page description`);
  pageTitles.add(pageTitle);
  pageDescriptions.add(pageDescription);
  canonical(html,plan.path);
  if ((html.match(/<h1\b/gi) || []).length !== 1) fail(`${plan.path}: expected one h1`);
  const escapedTitle = record.title.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  if (plan.action === "create" && !html.includes(`<h1>${escapedTitle}</h1>`)) fail(`${plan.path}: title does not match identity`);
  if (plan.action !== "create" && !new RegExp(`<h1[^>]*>${escapedTitle}`).test(html)) fail(`${plan.path}: title does not match identity`);
  if (!/<meta\s+name="description"\s+content="[^"<>]{30,}"/i.test(html)) fail(`${plan.path}: missing useful description`);
  if (plan.action === "create" && !html.includes(`src="/${record.thumbnail}"`)) fail(`${plan.path}: missing local artwork`);
  if (plan.action !== "create" && !html.includes(plan.id === "game-briarhold" ? "briarhold-key-art.png" : "og-image-v2.png")) fail(`${plan.path}: missing local artwork`);
  if (!html.includes('class="product-breadcrumbs"')) fail(`${plan.path}: missing visible breadcrumb`);
  for (const link of record.links || []) if (link.url !== plan.path && !html.includes(`href="${link.url.replace(/&/g,"&amp;")}"`)) fail(`${plan.path}: missing destination ${link.url}`);
  jsonGraphs(html,plan.path);
  localRefs(html,plan.path);
}
const inCategory = (project, category) => project.category === category || project.catalogues?.includes(category);
const sections = [
  ["/",Math.min(6,catalogue.filter((p)=>p.homepageRank || p.featured).length)],
  ["/games/",catalogue.filter((p)=>inCategory(p,"Games")).length],
  ["/books/",catalogue.filter((p)=>inCategory(p,"Books")).length],
  ["/apps/",catalogue.filter((p)=>["Apps & Tools","Assets"].includes(p.category)).length],
  ["/pocket-audio/",catalogue.filter((p)=>["Apps & Tools","Assets"].includes(p.category) && `${p.title} ${p.description} ${(p.tags||[]).join(" ")}`.toLowerCase().includes("pocket")).length],
  ["/music/",catalogue.filter((p)=>inCategory(p,"Music")).length],
  ["/links/",catalogue.filter((p)=>["Social","Storefronts"].includes(p.category)).length],
];
for (const [route,minimum] of sections) {
  const html = page(route);
  if (!html) continue;
  canonical(html,route);
  const cards = (html.match(/<article class="project-card /g) || []).length;
  if (cards < minimum) fail(`${route}: only ${cards} static catalogue cards (expected at least ${minimum})`);
  if (/<article class="project-card [^>]*data-reveal/.test(html)) fail(`${route}: pre-rendered cards must not be hidden by reveal animation`);
  jsonGraphs(html,route);
  localRefs(html,route);
}
const linkGroups = JSON.parse(fs.readFileSync(path.join(root,"content/link-groups.json"),"utf8"));
const linkPage = read("links/index.html");
if ((linkPage.match(/<section class="link-group">/g) || []).length !== linkGroups.length) fail("/links/: grouped links are not pre-rendered");
for (const group of linkGroups) for (const [,url] of group.links) if (!linkPage.includes(`href="${url.replace(/&/g,"&amp;")}"`)) fail(`/links/: missing grouped destination ${url}`);
const sitemap = read("sitemap.xml");
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m)=>m[1]);
if (new Set(locations).size !== locations.length) fail("sitemap: duplicate URLs");
for (const loc of locations) {
  if (!loc.startsWith("https://samfa12.com/")) { fail(`sitemap: noncanonical ${loc}`); continue; }
  const route = loc.slice("https://samfa12.com".length);
  const html = page(route);
  if (html) canonical(html,route);
}
for (const plan of manifest.products.filter((p)=>p.action !== "hold")) if (!locations.includes(`https://samfa12.com${plan.path}`)) fail(`sitemap: missing ${plan.path}`);
for (const plan of manifest.products.filter((p)=>p.action === "hold")) if (locations.includes(`https://samfa12.com${plan.path}`)) fail(`sitemap: held product included ${plan.path}`);
for (const relative of JSON.parse(fs.readFileSync(path.join(root,"content/generated-output-manifest.json"),"utf8")).pages) {
  const route = `/${relative.slice(0,-"index.html".length)}`;
  if (has(relative)) localRefs(read(relative),route);
}
errors.push(...brokenHostedEntrypoints(siteRoot));
for (const date of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) if (!/^\d{4}-\d{2}-\d{2}$/.test(date[1])) fail(`sitemap: invalid lastmod ${date[1]}`);
if (siteRoot !== root) {
  for (const forbidden of ["node_modules","content","scripts","tests","ops","workers","AGENTS.md",".env.analytics",".env.marketplace",".git",".github"]) if (has(forbidden)) fail(`staged artifact contains ${forbidden}`);
  for (const required of ["apps/what-would-win/legal-notices.txt","games/briarhold/play/index.html","apps/pocket-dj/index.html","apps/pocket-chordsmith/index.html"]) if (!has(required)) fail(`staged artifact missing ${required}`);
}
if (errors.length) { console.error(`SEO validation failed (${errors.length}):\n${errors.map((x)=>`- ${x}`).join("\n")}`); process.exit(1); }
assert.equal(ids.size,catalogue.length);
console.log(`SEO validation passed: ${manifest.products.length} product dispositions, ${locations.length} sitemap routes, ${sections.length} static catalogues${siteRoot === root ? "" : ", staged artifact"}.`);
