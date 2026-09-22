import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { html, jsonLd, safeRoute, safeUrl } from "../scripts/content-utils.mjs";

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
