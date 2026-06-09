import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "projects.json");
const thumbnailDir = path.join(root, "assets", "thumbnails");
const fallbackPath = "assets/thumbnails/fallback.webp";

const fallbackBase64 = "UklGRiIAAABXRUJQVlA4IBQAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v7+/v7+/gAAAA==";
const userAgent = "Mozilla/5.0 (compatible; Samfa12 website thumbnail crawler; +https://samfa12.website)";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");

const socialSkip = /x\.com|twitter\.com|facebook\.com|reddit\.com/i;
const badImageHint = /badge|avatar|icon|logo|logo-dark|sprite|cover_background|store_badges/i;

function normaliseTitle(title) {
  return title
    .toLowerCase()
    .replace(/[’'\"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

function isPlaceholderPath(imagePath) {
  return !imagePath || imagePath.endsWith(".svg") || /fallback|placeholder|dummy|temp|default/i.test(imagePath);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function pickSourceUrl(project) {
  const links = Array.isArray(project.links) ? project.links : [];
  const candidates = links.filter((link) => link?.url && !socialSkip.test(link.url));

  const ranked = candidates
    .map((link) => {
      const url = link.url;
      const label = (link.label || "").toLowerCase();
      let score = 0;

      if (/samfa12\.itch\.io\//.test(url)) score += 150;
      if (/amazon\.com\/stores/.test(url)) score += 120;
      if (/google\.com\/store\//.test(url)) score += 110;
      if (/store\.steampowered\.com/.test(url)) score += 100;
      if (/godotengine\.org\/asset-library\/asset\//.test(url)) score += 95;
      if (/github\.com/.test(url)) score += 60;
      if (/music|spotify|youtube/.test(url)) score += 35;
      if (/play on itch\.io|read on itch\.io/.test(label)) score += 30;
      return { url, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.url || null;
}

function collectCandidates(html, pageUrl) {
  const candidates = new Set();

  const addCandidate = (value) => {
    if (!value) return;
    try {
      const fixed = decodeHtmlEntities(value.trim());
      if (socialSkip.test(fixed)) return;
      if (badImageHint.test(fixed)) return;
      const normalized = new URL(fixed, pageUrl).toString();
      candidates.add(normalized);
    } catch (_error) {
      // ignore malformed URL values
    }
  };

  const metaRegex = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)];
  for (const match of metaRegex) {
    addCandidate(match[1]);
  }

  const imageSrcRegex = [...html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi)];
  for (const match of imageSrcRegex) {
    addCandidate(match[1]);
  }

  const ldJsonMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of ldJsonMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const image = Array.isArray(parsed?.image) ? parsed.image[0] : parsed?.image;
      if (typeof image === "string") addCandidate(image);
    } catch (_error) {
      // ignore malformed JSON
    }
  }

  const imgMatches = [...html.matchAll(/<img[^>]+(?:src|data-src|data-original)=['\"]([^'\"]+)['\"][^>]*>/gi)];
  for (const match of imgMatches) {
    if (badImageHint.test(match[1])) continue;
    addCandidate(match[1]);
  }

  const backgroundMatches = [...html.matchAll(/url\(['\"]([^'\"\)]+)['\"]/gi)];
  for (const match of backgroundMatches) {
    if (badImageHint.test(match[1])) continue;
    addCandidate(match[1]);
  }

  return [...candidates].filter((url) => /\.(png|jpe?g|webp|gif|bmp)(?:\?|#|$)/i.test(url));
}

function scoreCandidate(url) {
  let score = 0;
  const lower = url.toLowerCase();

  if (lower.includes("img.itch.zone") || lower.includes("images.itch.zone")) score += 50;
  if (lower.includes("/original/")) score += 45;
  if (/347x500|512x|640x|700x|794x1000|1024x|1200x/.test(lower)) score += 30;

  const dimMatch = lower.match(/(\d{3,5})x(\d{3,5})/);
  if (dimMatch) {
    const w = Number(dimMatch[1]);
    const h = Number(dimMatch[2]);
    score += Math.max(w, h) / 20;
  }

  return score;
}

function selectCandidate(candidates) {
  if (!candidates.length) return null;
  return candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
}

async function download(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Referer: "https://samfa12.itch.io/" },
    redirect: "follow",
  });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return null;

  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length) return null;

  return { contentType, data };
}

function extensionFor(contentType, imageUrl) {
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/gif")) return ".gif";

  const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return ext || ".png";
}

async function ensureFallback() {
  await fs.mkdir(thumbnailDir, { recursive: true });
  const localFallback = path.join(root, "assets", "thumbnails", "fallback.webp");
  if (!(await fileExists(localFallback))) {
    await fs.writeFile(localFallback, Buffer.from(fallbackBase64, "base64"));
  }
}

async function fetchProjectImage(project) {
  const sourceUrl = pickSourceUrl(project);
  if (!sourceUrl) {
    return { image: fallbackPath, status: "fallback", reason: "No source link." };
  }

  const response = await fetch(sourceUrl, { headers: { "User-Agent": userAgent }, redirect: "follow" });
  if (!response.ok) {
    return { image: fallbackPath, status: "fallback", reason: `Source fetch failed: ${response.status}` };
  }

  const html = await response.text();
  const candidates = collectCandidates(html, sourceUrl);
  if (!candidates.length) {
    return { image: fallbackPath, status: "fallback", reason: "No valid image candidate in source page." };
  }

  const selected = selectCandidate(candidates);
  const result = await download(selected);
  if (!result) {
    return { image: fallbackPath, status: "fallback", reason: `Could not download candidate: ${selected}` };
  }

  const ext = extensionFor(result.contentType, selected);
  const filename = `${normaliseTitle(project.title)}-${crypto.createHash("sha1").update(selected).digest("hex").slice(0, 6)}${ext}`;
  const output = path.join(thumbnailDir, filename);
  await fs.writeFile(output, result.data);
  return { image: `assets/thumbnails/${filename}`, status: "updated", reason: selected };
}

async function run() {
  await ensureFallback();
  const sourceData = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const projects = sourceData.map((project) => ({ ...project }));

  const report = [];

  for (const project of projects) {
    const hasRealImage =
      Boolean(project.image) &&
      !isPlaceholderPath(project.image) &&
      project.image !== fallbackPath &&
      (await fileExists(path.join(root, project.image)));

    if (!force && hasRealImage) {
      report.push({ title: project.title, status: "skipped", reason: "Existing real image." });
      continue;
    }

    try {
      const result = await fetchProjectImage(project);
      project.image = result.image;
      if (!project.imageAlt || /cover image/.test(project.imageAlt.toLowerCase())) {
        project.imageAlt = `Cover image for ${project.title}`;
      }
      report.push({ title: project.title, status: result.status, reason: result.reason });
    } catch (error) {
      project.image = fallbackPath;
      report.push({ title: project.title, status: "failed", reason: error?.message || "Unknown error." });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await fs.writeFile(dataPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");

  const statuses = {
    updated: report.filter((item) => item.status === "updated"),
    fallback: report.filter((item) => item.status === "fallback"),
    failed: report.filter((item) => item.status === "failed"),
    skipped: report.filter((item) => item.status === "skipped"),
  };

  console.log(`Fetched ${projects.length} projects.`);
  console.log(`updated: ${statuses.updated.length}`);
  console.log(`fallback: ${statuses.fallback.length}`);
  console.log(`failed: ${statuses.failed.length}`);
  console.log(`skipped: ${statuses.skipped.length}`);
}

await run();
