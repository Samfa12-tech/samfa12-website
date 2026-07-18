import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = process.env.WHAT_WOULD_WIN_SITE_ROOT ? path.resolve(process.env.WHAT_WOULD_WIN_SITE_ROOT) : root;
const hosted = path.join(siteRoot, "apps", "what-would-win", "index.html");

if (!fs.existsSync(hosted)) throw new Error(`What Would Win Pages artifact is missing: ${hosted}. Run npm run sync:what-would-win after building the source app.`);

const html = fs.readFileSync(hosted, "utf8");
const assets = [...html.matchAll(/(?:src|href)=["']([^"']*assets\/[^"']+)["']/gi)].map((match) => match[1]);
if (!/<div\s+id=["']root["']/i.test(html) || !assets.length) {
  throw new Error("What Would Win Pages artifact is missing its app root or built asset references.");
}
if (!html.includes('https://samfa12.com/apps/what-would-win/')) throw new Error("What Would Win Pages artifact is missing its canonical production URL.");
for (const asset of assets) {
  if (!fs.existsSync(path.join(path.dirname(hosted), asset))) throw new Error(`What Would Win Pages artifact references a missing asset: ${asset}`);
}
for (const required of [
  "site.webmanifest",
  "icons/favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "social/what-would-win-og.png",
]) {
  if (!fs.existsSync(path.join(path.dirname(hosted), required))) throw new Error(`What Would Win Pages artifact is missing ${required}.`);
}
console.log(`What Would Win Pages artifact verified (${assets.length} built asset reference(s), manifest, icons, and social card).`);
