import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { html, jsonLd, safeRoute, safeUrl } from "../scripts/content-utils.mjs";
import { brokenHostedEntrypoints } from "../scripts/hosted-entrypoints.mjs";
import { sitemapEntries, validateUpdateDates } from "../scripts/content-dates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(fs.readFileSync(path.join(root,"data/projects.json"),"utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root,"content/manifest.json"),"utf8"));
const copy = {
  ...JSON.parse(fs.readFileSync(path.join(root,"content/game-app-copy.json"),"utf8")),
  ...JSON.parse(fs.readFileSync(path.join(root,"content/book-music-copy.json"),"utf8")),
};
const sourceReview = JSON.parse(fs.readFileSync(path.join(root,"content/source-review.json"),"utf8"));

test("HTML and JSON-LD serialization cannot break out of markup", () => {
  const attack = '</script><img src=x onerror="alert(1)"> &';
  assert.equal(html(attack),"&lt;/script&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;");
  assert.doesNotMatch(jsonLd({name:attack}),/<\/script>/i);
  assert.deepEqual(JSON.parse(jsonLd({name:attack})),{name:attack});
});

test("routes and URLs reject traversal, script schemes and protected release copies", () => {
  assert.equal(safeRoute("/games/drink/"),"games/drink/index.html");
  for (const value of ["/games/../apps/", "/games/%2e%2e/", "/apps/pocket-dj/", "/games/briarhold/play/", "//elsewhere/"]) assert.throws(()=>safeRoute(value));
  for (const value of ["javascript:alert(1)","data:text/html,hello","//evil.example/","/games/../private/","/games\\private/","/games/\u0000/"]) assert.throws(()=>safeUrl(value));
  assert.equal(safeUrl("https://samfa12.itch.io/drink"),"https://samfa12.itch.io/drink");
});

test("all current records have a distinct product or directory disposition", () => {
  const ids = catalogue.map((p)=>p.id);
  assert.equal(new Set(ids).size,catalogue.length);
  assert.equal(catalogue.length,manifest.products.length+manifest.directories.length);
  assert.notEqual(catalogue.find((p)=>p.id==="game-dust-on-the-river").detailUrl,catalogue.find((p)=>p.id==="book-dust-on-the-river").detailUrl);
  assert.equal(catalogue.filter((p)=>p.id==="app-what-would-win").length,1);
  for (const item of manifest.products) {
    const record = catalogue.find((p)=>p.id===item.id);
    assert.ok(record,item.id);
    if (item.action === "hold") assert.equal(record.detailUrl,undefined,item.id);
    else assert.equal(record.detailUrl,item.path,item.id);
  }
});

test("visible claims and updates retain official source references", () => {
  assert.equal(Object.keys(sourceReview.products).length,manifest.products.length);
  for (const item of manifest.products.filter((p)=>p.action!=="hold")) {
    const record = copy[item.id];
    assert.ok(record?.intro && record.details?.length,item.id);
    const reviewed = new Map(sourceReview.products[item.id].sources.map((source)=>[source.url,source.access]));
    for (const claim of [...record.details,...(record.faqs||[])]) {
      assert.ok(claim.sources?.length,`${item.id}: claim source`);
      for (const source of claim.sources) {
        assert.match(safeUrl(source),/^https?:\/\//);
        assert.ok(reviewed.has(source) && !["attempted-inaccessible","catalogue-destination-not-used-for-claims"].includes(reviewed.get(source)),`${item.id}: unsupported source ${source}`);
      }
    }
    for (const update of record.updates||[]) {
      assert.match(update.date,/^\d{4}-\d{2}-\d{2}$/);
      assert.ok(update.dateMeaning && update.kind && update.id && update.sources?.length);
      assert.ok(Date.parse(update.date) <= Date.now(),`${item.id}: future update`);
    }
  }
});

test("generated pages contain initial content and direct actions", () => {
  for (const item of manifest.products.filter((p)=>p.action==="create")) {
    const file = path.join(root,safeRoute(item.path));
    const source = fs.readFileSync(file,"utf8");
    assert.match(source,/<h1>[^<]+<\/h1>/);
    assert.match(source,/<section class="section section-tight">/);
    assert.match(source,/<div class="product-actions">/);
    assert.match(source,/<script type="application\/ld\+json">/);
  }
  for (const route of ["index.html","games/index.html","books/index.html","apps/index.html","pocket-audio/index.html","music/index.html","links/index.html"]) {
    const source = fs.readFileSync(path.join(root,route),"utf8");
    assert.match(source,/<article class="project-card /,route);
    assert.doesNotMatch(source,/<article class="project-card [^>]*data-reveal/,route);
  }
});

test("Links page includes every grouped destination in initial HTML", () => {
  const groups = JSON.parse(fs.readFileSync(path.join(root,"content/link-groups.json"),"utf8"));
  const source = fs.readFileSync(path.join(root,"links/index.html"),"utf8");
  for (const group of groups) {
    for (const [label,url] of group.links) {
      assert.ok(source.includes(`href="${html(safeUrl(url))}"`),`${group.title}: ${label} URL`);
      assert.ok(source.includes(`>${html(label)} <span class="link-arrow"`),`${group.title}: ${label} label`);
    }
  }
  assert.ok(groups.find((group)=>group.title==="Follow").links.some(([label,url])=>label==="TikTok" && url==="https://www.tiktok.com/@samfa12_tech"));
});

test("What Would Win visible breadcrumb agrees with structured Apps parent", () => {
  const source = fs.readFileSync(path.join(root,"tools/what-would-win/index.html"),"utf8");
  assert.match(source,/<nav class="product-breadcrumbs"[^>]*>.*?<a href="\/apps\/">Apps<\/a>/);
  const graph = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
  const parent = graph.find((entry)=>entry["@type"]==="BreadcrumbList").itemListElement[1];
  assert.deepEqual([parent.name,parent.item],["Apps","https://samfa12.com/apps/"]);
});

test("Pocket Audio marketing titles differ from runtime and agree across metadata", () => {
  for (const [name,title] of [["pocket-chordsmith","Pocket Chordsmith browser music sketchpad"],["pocket-dj","Pocket DJ live remix deck for Chordsmith songs"]]) {
    const marketing = fs.readFileSync(path.join(root,`pocket-audio/${name}/index.html`),"utf8");
    const runtime = fs.readFileSync(path.join(root,`apps/${name}/index.html`),"utf8");
    const fullTitle = `${title} | Samfa12`;
    assert.ok(marketing.includes(`<title>${fullTitle}</title>`));
    assert.ok(marketing.includes(`<meta property="og:title" content="${fullTitle}"`));
    assert.ok(marketing.includes(`<meta name="twitter:title" content="${fullTitle}"`));
    const graph = JSON.parse(marketing.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
    assert.equal(graph.find((entry)=>entry["@type"]==="WebPage").name,fullTitle);
    assert.notEqual(runtime.match(/<title>([^<]+)<\/title>/)?.[1],fullTitle);
  }
});

test("home and main categories expose About and Updates in their footers", () => {
  for (const route of ["index.html","games/index.html","books/index.html","apps/index.html"]) {
    const footer = fs.readFileSync(path.join(root,route),"utf8").split('<footer class="site-footer">')[1];
    assert.match(footer,/<a href="\/updates\/">Updates<\/a>/,route);
    assert.match(footer,/<a href="\/about\/">About<\/a>/,route);
  }
});

test("public editorial copy states limitations without writing instructions to editors", () => {
  for (const [id,record] of Object.entries(copy)) {
    for (const claim of [...(record.details || []),...(record.faqs || [])]) {
      const text = claim.text || claim.answer;
      assert.doesNotMatch(text,/;\s*(?:do not|avoid|treat current|only the listed)/i,id);
    }
  }
});

test("hosted HTML script entry points resolve in the staged tree", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(),"samfa12-entrypoints-"));
  try {
    const app = path.join(fixture,"apps","pocket-chordsmith");
    fs.mkdirSync(app,{recursive:true});
    fs.writeFileSync(path.join(app,"index.html"),'<script type="module" src="./src/wav-export-preflight.js"></script>');
    assert.deepEqual(brokenHostedEntrypoints(fixture),["/apps/pocket-chordsmith/index.html: missing script entry point ./src/wav-export-preflight.js"]);
    fs.mkdirSync(path.join(app,"src"));
    fs.writeFileSync(path.join(app,"src","wav-export-preflight.js"),"export {};\n");
    assert.deepEqual(brokenHostedEntrypoints(fixture),[]);
  } finally {
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});

test("descriptive SEO titles stay aligned across generated metadata", () => {
  for (const plan of manifest.products.filter((item)=>item.action==="create" && copy[item.id]?.seoTitle)) {
    const source = fs.readFileSync(path.join(root,safeRoute(plan.path)),"utf8");
    const title = `${copy[plan.id].seoTitle} | Samfa12`;
    assert.ok(source.includes(`<title>${title}</title>`),plan.id);
    assert.ok(source.includes(`<meta property="og:title" content="${title}"`),plan.id);
    assert.ok(source.includes(`<meta name="twitter:title" content="${title}"`),plan.id);
    const graph = JSON.parse(source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
    assert.equal(graph.find((item)=>item["@type"]==="WebPage").name,title,plan.id);
  }
});

test("sitemap dates follow explicit page sources, not the build clock", () => {
  const site = [{route:"/",pageModified:"2026-01-01"},{route:"/updates/",pageModified:"2026-02-01"}];
  const products = {products:[{id:"game-test",path:"/games/test/",action:"create",pageModified:"2026-02-01"}]};
  const hubs = [{route:"/books/series/",pageModified:"2026-01-15"}];
  const before = sitemapEntries(site,products,hubs);
  products.products[0].pageModified = "2026-02-03";
  const after = sitemapEntries(site,products,hubs);
  assert.deepEqual(after.filter(([route,date])=>date!==before.find(([oldRoute])=>oldRoute===route)?.[1]),[["/games/test/","2026-02-03"]]);
  const copy = {"game-test":{updates:[{id:"release",date:"2026-02-04"}]}};
  assert.throws(()=>validateUpdateDates(site,products,copy),/pageModified predates update/);
  products.products[0].pageModified = "2026-02-04";
  assert.throws(()=>validateUpdateDates(site,products,copy),/\/updates\/ pageModified predates update/);
  site[1].pageModified = "2026-02-04";
  assert.doesNotThrow(()=>validateUpdateDates(site,products,copy));
});

test("related links resolve to an approved catalogue identity", () => {
  const plans = new Map(manifest.products.map((item)=>[item.id,item]));
  for (const [id,record] of Object.entries(copy)) {
    for (const relatedId of record.relatedIds || []) {
      assert.notEqual(relatedId,id);
      assert.ok(plans.has(relatedId) && plans.get(relatedId).action!=="hold",`${id} -> ${relatedId}`);
    }
    for (const labelId of Object.keys(record.relatedLabels || {})) assert.ok(record.relatedIds?.includes(labelId),`${id} related label ${labelId}`);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root,"games/breakfast-beat/index.html"),"utf8"),/href="\/music\/tower-defense-pack-ost\/"/);
});

test("Pocket Pattern has one itch-hosted game identity and a sourced static page", () => {
  const records = catalogue.filter((item)=>item.id==="game-pocket-pattern");
  assert.equal(records.length,1);
  const game = records[0];
  assert.equal(game.title,"Pocket Pattern");
  assert.equal(game.category,"Games");
  assert.equal(game.detailUrl,"/games/pocket-pattern/");
  assert.deepEqual(game.links,[{label:"Play on itch.io",url:"https://samfa12.itch.io/pocket-pattern"}]);
  assert.ok(fs.existsSync(path.join(root,game.thumbnail)));
  const page = fs.readFileSync(path.join(root,"games/pocket-pattern/index.html"),"utf8");
  assert.match(page,/<h1>Pocket Pattern<\/h1>/);
  assert.match(page,/href="https:\/\/samfa12\.itch\.io\/pocket-pattern"/);
  assert.match(page,/3×3 colour target/);
  assert.match(page,/id="pocket-pattern-itch-publication-september-2026"/);
  assert.ok(fs.readFileSync(path.join(root,"updates/index.html"),"utf8").includes('/games/pocket-pattern/#pocket-pattern-itch-publication-september-2026'));
  assert.equal(fs.existsSync(path.join(root,"games/pocket-pattern/play/index.html")),false);
});

// Exercise the shipped catalogue classifier without starting browser services.
const siteScript = fs.readFileSync(path.join(root, "script.js"), "utf8");
function scriptSection(start, end) {
  const from = siteScript.indexOf(start);
  const to = siteScript.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing catalogue script section: ${start}`);
  return siteScript.slice(from, to);
}
const catalogueContext = vm.createContext({ URL, window: { location: { origin: "https://samfa12.com" } } });
vm.runInContext([
  scriptSection("const CATALOGUE_FILTER_CONFIG =", "function createElement("),
  scriptSection("function safeHostname(", "function createSvgElement("),
  scriptSection("function safePathname(", "function deriveBookCatalogueLabels("),
].join("\n"), catalogueContext);
function gameLabels(project) {
  return Array.from(catalogueContext.deriveGameCatalogueLabels(project, project.links || []));
}

test("Horde benchmark information never marks the native demo as Browser", () => {
  const horde = catalogue.find((project) => project.id === "game-the-horde");
  assert.ok(horde.links.some((link) => link.url === "/games/the-horde/benchmark-stats/"));
  assert.deepEqual(gameLabels(horde), ["itch.io"]);
  assert.equal([horde].filter((project) => gameLabels(project).includes("Browser")).length, 0);
});

test("local game detail, benchmark and download links are not browser-play evidence", () => {
  for (const link of [
    { label: "Learn more", url: "/games/the-horde/" },
    { label: "How does it perform?", url: "/games/the-horde/benchmark-stats/" },
    { label: "Download for Windows", url: "/games/the-horde/download/" },
  ]) {
    assert.deepEqual(gameLabels({ type: "Tech demo", links: [link] }), []);
    assert.deepEqual(gameLabels({ type: "Tech demo", links: [
      { label: "Download on itch.io", url: "https://samfa12.itch.io/the-horde" }, link,
    ] }), ["itch.io"]);
  }
});

test("local Play actions and declared browser games keep the Browser filter", () => {
  for (const id of ["game-bug-swarm", "game-cursed-cutter", "game-briarhold", "game-breakfast-beat-down", "game-banana-banana-ducky", "game-pocket-pattern", "game-towtal-chaos"]) {
    const project = catalogue.find((record) => record.id === id);
    assert.ok(project, id);
    assert.ok(gameLabels(project).includes("Browser"), id);
  }
  assert.deepEqual(gameLabels({ type: "Game", links: [
    { label: "Learn more", url: "/games/example/" },
    { label: "Play now", url: "/games/example/play/" },
  ] }), ["Browser"]);
});

test("storefront labels remain unchanged for native games", () => {
  const drink = catalogue.find((project) => project.id === "game-drink");
  assert.deepEqual(gameLabels(drink), ["itch.io", "Google Play", "Steam"]);
  assert.deepEqual(gameLabels({ type: "Game", links: [
    { label: "Play on itch.io", url: "https://samfa12.itch.io/example" },
  ] }), ["itch.io"]);
});
vm.runInContext([
  "const savedCatalogueCards = new WeakMap();",
  scriptSection("function safeUrl(", "function safeHostname("),
  scriptSection("function deriveBookCatalogueLabels(", "function normalizeProject("),
  scriptSection("function isInCatalogue(", "function normalizeProjects("),
  scriptSection("function getSavedCatalogueCards(", "function renderCatalogue("),
].join("\n"), catalogueContext);

function savedCardFixture(type, title, links) {
  return {
    querySelector(selector) {
      if (selector === ".project-label") return { textContent: type };
      if (selector === "h3") return { textContent: title };
      throw new Error(`Unexpected saved-card selector: ${selector}`);
    },
    querySelectorAll(selector) {
      assert.equal(selector, ".project-actions a[href]");
      return links.map(({ url, label, text = label }) => ({
        getAttribute(name) { assert.equal(name, "href"); return url; },
        dataset: label === undefined ? {} : { linkLabel: label },
        textContent: text,
      }));
    },
  };
}
function savedCardLabels(cards) {
  const grid = { querySelectorAll(selector) { assert.equal(selector, ".project-card"); return cards; } };
  return Array.from(catalogueContext.getSavedCatalogueCards(grid, "Games"), (project) => Array.from(project.catalogueLabels));
}

test("saved generated cards retain Play action labels and exclude Horde information links", () => {
  const gamesHtml = fs.readFileSync(path.join(root, "games/index.html"), "utf8");
  const cards = ["game-the-horde", "game-bug-swarm", "game-briarhold"].map((id) => {
    const card = Array.from(gamesHtml.matchAll(/<article\b[^>]*data-project-id="([^"]+)"[\s\S]*?<\/article>/g)).find((match) => match[1] === id)?.[0];
    assert.ok(card, id);
    const type = card.match(/<p class="project-label">([^<]*)<\/p>/)?.[1] || "";
    const actions = card.split('<div class="project-actions"')[1];
    const links = Array.from(actions.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*data-link-label="([^"]+)"/g), (match) => ({ url: match[1], label: match[2], text: `${match[2]} ->` }));
    assert.ok(links.length, id);
    return savedCardFixture(type, id, links);
  });
  assert.deepEqual(savedCardLabels(cards), [["itch.io"], ["Browser"], ["Browser"]]);
});

test("saved-card adapter uses visible Play text when metadata is absent, not arbitrary local routes", () => {
  const cards = [
    savedCardFixture("Game", "Browser build", [{ url: "/games/example/play/", text: "  Play now ->  " }]),
    savedCardFixture("Tech demo", "Native demo", [
      { url: "/games/the-horde/", text: "Learn more ->" },
      { url: "/games/the-horde/benchmark-stats/", label: "How does it perform?", text: "How does it perform? ->" },
      { url: "/games/the-horde/download/", text: "Download for Windows ->" },
    ]),
  ];
  assert.deepEqual(savedCardLabels(cards), [["Browser"], []]);
});
test("Chrome Coalition is in the saved and dynamic games catalogue as a playable early build", () => {
  const record = catalogue.find((p) => p.id === "game-chrome-coalition");
  assert.ok(record);
  assert.equal(record.detailUrl, "/games/chrome-coalition-warlords/");
  assert.match(record.status, /early build live/i);
  assert.deepEqual(Array.from(catalogueContext.deriveGameCatalogueLabels(record, record.links)), ["Browser", "Wavedash"]);
  const games = fs.readFileSync(path.join(root, "games/index.html"), "utf8");
  const card = Array.from(games.matchAll(/<article\b[^>]*data-project-id="([^"]+)"[\s\S]*?<\/article>/g)).find((match) => match[1] === record.id)?.[0];
  assert.ok(card);
  assert.match(card, /Early build live on Wavedash/);
  assert.match(card, /href="\/games\/chrome-coalition-warlords\/"/);
  assert.match(card, /chrome-coalition-cover-960\.webp/);
  assert.match(card, /href="https:\/\/wavedash\.com\/games\/chrome-coalition"/);
  assert.doesNotMatch(card, /Coming soon|planned multiplayer/i);
});

test("verified engine labels are retained in static catalogue and runtime rendering", () => {
  const page = fs.readFileSync(path.join(root,"games/index.html"),"utf8");
  for (const project of catalogue.filter(p=>p.engine)) {
    assert.ok(["Babylon.js","Three.js","Godot","HTML5","HTML5 collection","Babylon.js collection","JavaScript / Canvas 2D","Custom WebGL2","Custom C++ / Vulkan"].includes(project.engine));
    assert.ok(page.includes(`Built with ${project.engine}`));
    assert.equal(sourceReview.products[project.id].engineReview.engine, project.engine);
  }
  assert.match(fs.readFileSync(path.join(root,"script.js"),"utf8"), /Built with \$\{project.engine\}/);
});

test('withdrawn book itch links stay out of public pages while exceptions remain', () => {
  const withdrawn = ['toknight', 'toknight-2-the-fire-beneath', 'free-to-a-good-home', 'a-place-of-his-own', 'colossal', 'concubine'];
  const pages = ['toknight', 'toknight-2-the-fire-beneath', 'free-to-a-good-home', 'a-place-of-his-own', 'colossal', 'concubine', 'jason-proud', 'free-to-a-good-home-books'];
  for (const slug of pages) {
    const html = fs.readFileSync(new URL(`../books/${slug}/index.html`, import.meta.url), 'utf8');
    for (const dead of withdrawn) assert.ok(!html.includes(`https://samfa12.itch.io/${dead}"`), `${slug} links to ${dead}`);
  }
  for (const [slug, url] of [['sober','sober'], ['article-18','article-18'], ['backwater','backwater'], ['dust-on-the-river','dust-on-the-river']]) {
    const html = fs.readFileSync(new URL(`../books/${slug}/index.html`, import.meta.url), 'utf8');
    assert.ok(html.includes(`https://samfa12.itch.io/${url}`), `${slug} exception missing`);
  }
});
