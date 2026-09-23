import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
