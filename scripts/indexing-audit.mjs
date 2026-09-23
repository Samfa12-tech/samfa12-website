import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://samfa12.com";
const reportFile = path.join(root, "ops/seo/indexing-audit.json");
const ignoredDirectories = new Set([".git", ".github", ".playwright-cli", "node_modules", "_site", "content", "ops", "output", "scripts", "tests", "workers", "artifacts"]);
const runtimeRoutes = new Set(["/apps/pocket-chordsmith/", "/apps/pocket-dj/", "/apps/what-would-win/", "/games/briarhold/play/", "/games/bug-swarm/", "/games/cursed-cutter/"]);

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [match[1].toLowerCase(), match[3]]));
}
function visibleText(markup) {
  return markup.replace(/<[^>]*>/g, "").replace(/&#(x[\da-f]+|\d+);|&([a-z]+);/gi, (entity, number, named) => {
    if (number) return String.fromCodePoint(number[0].toLowerCase() === "x" ? parseInt(number.slice(1),16) : parseInt(number,10));
    return {amp:"&",quot:'"',apos:"'",lt:"<",gt:">"}[named.toLowerCase()] || entity;
  }).trim();
}
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => attributes(match[0]));
}
function htmlFiles(directory, top = true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (top && ignoredDirectories.has(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file, false) : entry.isFile() && entry.name.endsWith(".html") ? [file] : [];
  });
}
function routeFor(relative) {
  const url = `/${relative.replaceAll(path.sep, "/")}`;
  return url.endsWith("/index.html") ? url.slice(0, -"index.html".length) : url === "/index.html" ? "/" : url;
}
function targetRoute(reference, sourceRoute) {
  if (!reference || reference.startsWith("#") || /^(?:mailto:|tel:|javascript:|data:)/i.test(reference)) return null;
  let url, pathname;
  try { url = new URL(reference, `${base}${sourceRoute}`); pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (url.origin !== base) return null;
  return pathname.endsWith("/index.html") ? pathname.slice(0,-"index.html".length) : pathname;
}
function fileForUrl(siteRoot, pathname) {
  const relative = pathname.endsWith("/") ? `${pathname.slice(1)}index.html` : pathname.slice(1);
  return path.join(siteRoot, relative);
}
function jsonNodes(source, issues, route) {
  const nodes = [];
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const block = JSON.parse(match[1]);
      nodes.push(...(block["@graph"] || [block]));
    } catch (error) { issues.push(`${route}: malformed JSON-LD (${error.message})`); }
  }
  return nodes;
}
function visibleBreadcrumb(source) {
  const nav = source.match(/<nav\b[^>]*class=["'][^"']*product-breadcrumbs[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1];
  if (!nav) return null;
  const links = [...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({href:attributes(match[0]).href, name:visibleText(match[1])}));
  const current = visibleText(nav.match(/<span\b[^>]*aria-current=["']page["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
  return {links,current};
}
function parentFor(route, productPaths, hubRoutes) {
  if (hubRoutes.has(route)) return "/books/";
  if (!productPaths.has(route)) return null;
  if (route.startsWith("/books/")) return "/books/";
  if (route.startsWith("/music/")) return "/music/";
  if (route.startsWith("/pocket-audio/")) return "/pocket-audio/";
  if (route.startsWith("/tools/")) return "/apps/";
  if (route.startsWith("/apps/")) return "/apps/";
  return "/games/";
}

export function auditIndexing(siteRoot = root) {
  const sitemap = fs.readFileSync(path.join(siteRoot, "sitemap.xml"), "utf8");
  const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(base,""));
  const sitemapSet = new Set(sitemapRoutes);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "content/manifest.json"), "utf8"));
  const hubs = JSON.parse(fs.readFileSync(path.join(root, "content/hubs.json"), "utf8"));
  const productPaths = new Set(manifest.products.filter((item) => item.action !== "hold").map((item) => item.path));
  const productById = new Map(manifest.products.map((item)=>[item.id,item]));
  const hubRoutes = new Set(hubs.map((item) => item.route));
  const copy = {...JSON.parse(fs.readFileSync(path.join(root,"content/game-app-copy.json"),"utf8")),...JSON.parse(fs.readFileSync(path.join(root,"content/book-music-copy.json"),"utf8"))};
  const relationshipEdges = manifest.products.filter((plan)=>plan.path).flatMap((plan)=>(copy[plan.id]?.relatedIds || []).map((id)=>({from:plan.path,to:productById.get(id)?.path || null,kind:"editorial-related"}))).concat(hubs.flatMap((hub)=>hub.books.map((id)=>({from:hub.route,to:productById.get(id)?.path || null,kind:"reading-order"})))).sort((a,b)=>a.from.localeCompare(b.from)||(a.to || "").localeCompare(b.to || "")||a.kind.localeCompare(b.kind));
  const pages = htmlFiles(siteRoot).map((file) => ({file, route:routeFor(path.relative(siteRoot,file)), source:fs.readFileSync(file,"utf8")}));
  const indexable = [];
  const excluded = [];
  const issues = [];
  const incoming = new Map();
  const incomingMain = new Map();
  for (const page of pages) {
    const canonicalLinks = tags(page.source,"link").filter((item) => item.rel?.toLowerCase() === "canonical");
    const noindex = tags(page.source,"meta").some((item) => item.name?.toLowerCase() === "robots" && /\bnoindex\b/i.test(item.content || ""));
    if (noindex) {
      excluded.push({route:page.route,reason:"explicit noindex"});
      if (sitemapSet.has(page.route)) issues.push(`${page.route}: noindex page is in sitemap`);
      continue;
    }
    if (!canonicalLinks.length) { issues.push(`${page.route}: HTML page has neither canonical nor noindex`); continue; }
    indexable.push({...page,canonicalLinks});
  }
  const routeSet = new Set(indexable.map((page) => page.route));
  for (const sourcePage of indexable) {
    const main = sourcePage.source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    for (const [html, counter] of [[sourcePage.source,incoming],[main,incomingMain]]) {
      const destinations = new Set(tags(html,"a").map((item) => targetRoute(item.href,sourcePage.route)).filter((route) => route && route !== sourcePage.route && routeSet.has(route)));
      for (const route of destinations) {
        if (!counter.has(route)) counter.set(route,new Set());
        counter.get(route).add(sourcePage.route);
      }
    }
  }
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const routes = indexable.map(({route,source,canonicalLinks}) => {
    const findings = [];
    const runtime = runtimeRoutes.has(route);
    const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
    const description = tags(source,"meta").find((item) => item.name?.toLowerCase() === "description")?.content || "";
    const heading = [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => visibleText(match[1]));
    const canonical = canonicalLinks[0]?.href || "";
    const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    if (canonicalLinks.length !== 1 || canonical !== `${base}${route}`) findings.push("missing, duplicate, or non-self canonical");
    if (!sitemapSet.has(route)) findings.push("canonical page absent from sitemap");
    if (!title) findings.push("missing title");
    if (!description) findings.push("missing description");
    if (!runtime && (heading.length !== 1 || !heading[0])) findings.push("marketing page needs one visible H1");
    if (!runtime && !main) findings.push("marketing page has no initial main content");
    if (!runtime && productPaths.has(route) && !/product-prose|product-actions/.test(main)) findings.push("product explanation missing from initial HTML");
    if (!runtime && ["/","/games/","/books/","/apps/","/pocket-audio/","/music/","/links/"].includes(route) && !main.includes("project-card")) findings.push("catalogue cards missing from initial HTML");
    const localAssets = [...tags(source,"img").map((item)=>item.src),...tags(source,"script").map((item)=>item.src),...tags(source,"link").filter((item)=>["stylesheet","icon"].includes(item.rel)).map((item)=>item.href)].filter(Boolean);
    if (!runtime) for (const link of tags(source,"a")) {
      if (/^(?:javascript:|vbscript:|data:)/i.test(link.href || "")) findings.push(`unsafe link URL: ${link.href}`);
      if (/^http:\/\//i.test(link.href || "")) findings.push(`insecure external link: ${link.href}`);
    }
    const meta = tags(source,"meta");
    for (const key of ["og:image","twitter:image"]) {
      const image = meta.find((item)=>item.property === key || item.name === key)?.content;
      if (!image && !runtime) findings.push(`missing ${key} card image`);
      if (image) localAssets.push(image);
    }
    const missingAssets = [...new Set(localAssets)].filter((reference)=>{
      const target=targetRoute(reference,route);
      return target && !fs.existsSync(fileForUrl(siteRoot,target));
    });
    if (missingAssets.length) findings.push(`missing local assets: ${missingAssets.join(", ")}`);
    const schemaIssues = [];
    const nodes = jsonNodes(source,schemaIssues,route);
    findings.push(...schemaIssues.map((item)=>item.replace(`${route}: `,"")));
    if (!runtime && !nodes.length) findings.push("marketing page has no JSON-LD");
    const webPage = nodes.find((item)=>["WebPage","CollectionPage","AboutPage"].includes(item["@type"]));
    if (webPage?.url && webPage.url !== `${base}${route}`) findings.push("WebPage URL differs from canonical");
    if (!runtime && nodes.length) {
      const organization = nodes.find((item)=>item["@id"] === `${base}/#organization`);
      const website = nodes.find((item)=>item["@id"] === `${base}/#website`);
      if (organization?.name !== "Samfa12" || organization.url !== `${base}/`) findings.push("Organization identity is inconsistent");
      if (website?.publisher?.["@id"] !== `${base}/#organization` || webPage?.isPartOf?.["@id"] !== `${base}/#website`) findings.push("WebPage is not linked to the Samfa12 website and organization");
    }
    const product = nodes.find((item)=>["VideoGame","SoftwareApplication","Book","MusicAlbum","CreativeWork"].includes(item["@type"]) && item.url === `${base}${route}`);
    if (product && !runtime && !productPaths.has(route)) findings.push("product schema has no catalogue disposition");
    if (productPaths.has(route) && !runtime && product && !heading[0]?.startsWith(product.name)) findings.push("product schema name differs from visible H1");
    const breadcrumb = visibleBreadcrumb(source);
    const breadcrumbNode = nodes.find((item)=>item["@type"] === "BreadcrumbList");
    if (breadcrumb && breadcrumbNode) {
      for (const [index,link] of breadcrumb.links.entries()) {
        const structured = breadcrumbNode.itemListElement?.[index];
        if (!structured || structured.name !== link.name || structured.item !== `${base}${link.href}`) findings.push("visible and structured breadcrumbs disagree");
      }
      const final = breadcrumbNode.itemListElement?.at(-1);
      if (final?.name !== breadcrumb.current || final?.item !== `${base}${route}`) findings.push("structured breadcrumb does not match visible current page");
    } else if (!runtime && (productPaths.has(route) || hubRoutes.has(route)) && (!breadcrumb || !breadcrumbNode)) findings.push("missing visible or structured breadcrumb");
    const parent = parentFor(route,productPaths,hubRoutes);
    if (parent && breadcrumb?.links?.[1]?.href !== parent) findings.push(`unexpected parent; expected ${parent}`);
    const referring = [...(incoming.get(route) || [])].sort();
    const contextual = [...(incomingMain.get(route) || [])].sort();
    if (route !== "/" && !referring.length) findings.push("orphaned indexable page");
    if (!runtime && route !== "/" && !contextual.length) findings.push("weak contextual incoming links");
    if (titleOwners.has(title)) findings.push(`duplicate title with ${titleOwners.get(title)}`);
    else titleOwners.set(title,route);
    if (descriptionOwners.has(description)) findings.push(`duplicate description with ${descriptionOwners.get(description)}`);
    else descriptionOwners.set(description,route);
    const advisories = !runtime && route !== "/" && contextual.length === 1 ? ["one contextual incoming page; review only when a genuine relationship exists"] : [];
    return {route,kind:runtime?"runtime":productPaths.has(route)?"product":hubRoutes.has(route)?"reading-hub":"site",canonical,title,description,h1:heading,inSitemap:sitemapSet.has(route),incoming:referring,incomingMain:contextual,localAssetCount:localAssets.length,jsonLdStatus:nodes.length?"parsed":"not present",jsonLdTypes:[...new Set(nodes.map((node)=>node["@type"]).filter(Boolean))],findings,advisories};
  }).sort((a,b)=>a.route.localeCompare(b.route));
  const canonicalOwners = new Map();
  for (const page of routes) {
    if (canonicalOwners.has(page.canonical)) page.findings.push(`duplicate canonical with ${canonicalOwners.get(page.canonical)}`);
    else canonicalOwners.set(page.canonical,page.route);
  }
  for (const route of sitemapRoutes) if (!routeSet.has(route)) issues.push(`${route}: sitemap route lacks an indexable deployed page`);
  if (sitemapRoutes.length !== sitemapSet.size) issues.push("sitemap has duplicate routes");
  const problemRoutes = routes.filter((page)=>page.findings.length);
  return {version:1,site:base,summary:{htmlPages:pages.length,indexableRoutes:routes.length,sitemapRoutes:sitemapRoutes.length,explicitlyExcluded:excluded.length,routesWithFindings:problemRoutes.length,siteFindings:issues.length,oneContextualIncoming:routes.filter((page)=>page.advisories.length).length,relationshipEdges:relationshipEdges.length},excluded:excluded.sort((a,b)=>a.route.localeCompare(b.route)),siteFindings:issues.sort(),relationshipEdges,routes};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const siteRoot = path.resolve(process.env.SEO_SITE_ROOT || root);
  const result = `${JSON.stringify(auditIndexing(siteRoot),null,2)}\n`;
  if (process.argv.includes("--write")) {
    fs.mkdirSync(path.dirname(reportFile),{recursive:true});
    fs.writeFileSync(reportFile,result);
  } else if (process.argv.includes("--check")) {
    if (!fs.existsSync(reportFile) || fs.readFileSync(reportFile,"utf8") !== result) {
      console.error("Indexing audit snapshot is stale; run npm run audit:indexing -- --write and review the diff.");
      process.exitCode = 1;
    }
  } else process.stdout.write(result);
  const report = JSON.parse(result);
  const knownRuntimeGap = new Set(["/games/bug-swarm/: missing description"]);
  const unaccepted = [...report.siteFindings,...report.routes.flatMap((page)=>page.findings.map((finding)=>`${page.route}: ${finding}`))].filter((finding)=>!knownRuntimeGap.has(finding));
  if (process.argv.includes("--check") && unaccepted.length) {
    console.error(`Indexing audit has ${unaccepted.length} new technical finding(s):\n${unaccepted.join("\n")}`);
    process.exitCode = 1;
  }
  console.error(`Indexing audit: ${report.summary.indexableRoutes} canonical routes, ${report.summary.routesWithFindings} route findings, ${report.summary.siteFindings} site findings.`);
}
