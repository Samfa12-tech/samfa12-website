import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "projects.json");
const errors = [];
const warnings = [];

function readProjects() {
  try {
    const raw = readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      errors.push("data/projects.json must be a top-level array.");
      return [];
    }
    return parsed;
  } catch (error) {
    errors.push(`Could not parse data/projects.json: ${error.message}`);
    return [];
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeLocalUrl(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value);
}

function localUrlExists(value) {
  const localPath = value.split(/[?#]/, 1)[0];
  const relative = localPath.replace(/^\/+/, "");
  const absolute = path.join(root, relative);
  if (existsSync(absolute)) return true;
  if (localPath.endsWith("/") && existsSync(path.join(absolute, "index.html"))) return true;
  return false;
}

function isSafeThumbnail(value) {
  if (typeof value !== "string" || !value.trim()) return true;
  const normalized = value.trim().replace(/\\/g, "/");
  return /^assets\/thumbnails\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp|gif|svg)$/i.test(normalized) && !normalized.includes("..");
}

function normalizeRecord(record, index) {
  if (!record || typeof record !== "object") {
    errors.push(`Record ${index + 1} must be an object.`);
    return null;
  }

  const title = typeof record.title === "string" ? record.title.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  if (!title) errors.push(`Record ${index + 1} is missing a title.`);
  if (!category) errors.push(`${title || `Record ${index + 1}`} is missing a category.`);

  const links = Array.isArray(record.links) ? record.links : [];
  const validLinks = links.filter((link) => {
    const url = typeof link?.url === "string" ? link.url.trim() : "";
    return isSafeLocalUrl(url) || isHttpUrl(url);
  });

  if (links.length && !validLinks.length) {
    errors.push(`${title || `Record ${index + 1}`} has links, but none have a valid http(s) or root-relative URL.`);
  }

  validLinks.forEach((link) => {
    const url = link.url.trim();
    if (isSafeLocalUrl(url) && !localUrlExists(url)) {
      errors.push(`${title} links to missing local route: ${url}`);
    }
  });

  const thumbnail = record.thumbnail ?? record.image;
  if (!isSafeThumbnail(thumbnail)) {
    errors.push(`${title || `Record ${index + 1}`} has an unsafe thumbnail path: ${thumbnail}`);
  } else if (typeof thumbnail === "string" && thumbnail.trim()) {
    const thumbnailPath = path.join(root, thumbnail.trim().replace(/\//g, path.sep));
    if (!existsSync(thumbnailPath)) {
      warnings.push(`${title} thumbnail is missing; the site will render a text fallback: ${thumbnail}`);
    }
  }

  return { ...record, title, category, validLinks };
}

const projects = readProjects().map(normalizeRecord).filter(Boolean);

const pageChecks = [
  {
    label: "/games/",
    predicate: (project) => project.category === "Games",
  },
  {
    label: "/books/",
    predicate: (project) => project.category === "Books",
  },
  {
    label: "/music/",
    predicate: (project) => project.category === "Music",
  },
  {
    label: "/pocket-audio/",
    predicate: (project) => {
      const text = `${project.title} ${project.description || ""} ${(project.tags || []).join(" ")}`.toLowerCase();
      return (project.category === "Apps & Tools" || project.category === "Assets") && text.includes("pocket");
    },
  },
  {
    label: "/apps/",
    predicate: (project) => project.category === "Apps & Tools" || project.category === "Assets",
  },
  {
    label: "/links/",
    predicate: (project) => project.category === "Social" || project.category === "Storefronts",
  },
];

pageChecks.forEach(({ label, predicate }) => {
  const count = projects.filter(predicate).length;
  if (!count) errors.push(`${label} would render zero catalogue cards from data/projects.json.`);
});

const cursedCutter = projects.find((project) => project.title === "Cursed Cutter");
if (!cursedCutter) {
  errors.push("Cursed Cutter is missing from data/projects.json.");
} else if (!cursedCutter.validLinks.some((link) => link.url === "/games/cursed-cutter/")) {
  errors.push("Cursed Cutter must link to /games/cursed-cutter/.");
}

if (warnings.length) {
  console.warn("Catalogue validation warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error("Catalogue validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Catalogue validation passed for ${projects.length} project records.`);
