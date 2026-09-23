import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditIndexing } from "../scripts/indexing-audit.mjs";

test("audit detects an orphan, unsitemapped canonical and duplicate canonical", () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(),"samfa12-index-audit-"));
  const page = (canonical) => `<!doctype html><title>Example ${canonical}</title><meta name="description" content="Example description ${canonical}"><link rel="canonical" href="${canonical}"><main><h1>Example</h1></main>`;
  try {
    fs.writeFileSync(path.join(site,"sitemap.xml"),'<loc>https://samfa12.com/</loc>');
    fs.writeFileSync(path.join(site,"index.html"),page("https://samfa12.com/"));
    fs.mkdirSync(path.join(site,"games","orphan"),{recursive:true});
    fs.writeFileSync(path.join(site,"games","orphan","index.html"),page("https://samfa12.com/games/orphan/"));
    const report = auditIndexing(site);
    const orphan = report.routes.find(({route})=>route==="/games/orphan/");
    assert.ok(orphan.findings.includes("orphaned indexable page"));
    assert.ok(orphan.findings.includes("canonical page absent from sitemap"));
    fs.mkdirSync(path.join(site,"books"));
    fs.writeFileSync(path.join(site,"books","index.html"),page("https://samfa12.com/games/orphan/"));
    assert.ok(auditIndexing(site).routes.some(({findings})=>findings.some((finding)=>finding.startsWith("duplicate canonical"))));
  } finally { fs.rmSync(site,{recursive:true,force:true}); }
});

test("audit compares visible and structured breadcrumbs and excludes noindex HTML", () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(),"samfa12-breadcrumb-audit-"));
  try {
    fs.writeFileSync(path.join(site,"sitemap.xml"),'<loc>https://samfa12.com/</loc>');
    fs.writeFileSync(path.join(site,"index.html"),`<!doctype html><title>Home</title><meta name="description" content="A useful home page"><link rel="canonical" href="https://samfa12.com/"><main><h1>Home</h1><nav class="product-breadcrumbs"><a href="/">Home</a><a href="/books/">Books</a><span aria-current="page">Home</span></nav></main><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"name":"Home","item":"https://samfa12.com/"},{"name":"Games","item":"https://samfa12.com/games/"},{"name":"Home","item":"https://samfa12.com/"}]}]}</script>`);
    fs.mkdirSync(path.join(site,"legacy"));
    fs.writeFileSync(path.join(site,"legacy","index.html"),'<meta name="robots" content="noindex"><title>Legacy</title>');
    const report = auditIndexing(site);
    assert.ok(report.routes[0].findings.includes("visible and structured breadcrumbs disagree"));
    assert.deepEqual(report.excluded,[{route:"/legacy/",reason:"explicit noindex"}]);
  } finally { fs.rmSync(site,{recursive:true,force:true}); }
});
