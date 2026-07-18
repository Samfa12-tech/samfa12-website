import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "projects.json");
const errors = [];
const warnings = [];
const allowedCatalogues = new Set(["Games", "Books", "Apps & Tools", "Assets", "Music", "Social", "Storefronts"]);

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

  let catalogues = [];
  if (record.catalogues !== undefined) {
    if (!Array.isArray(record.catalogues)) {
      errors.push(`${title || `Record ${index + 1}`} catalogues must be an array of allowed category names.`);
    } else {
      catalogues = record.catalogues.map((catalogue) => typeof catalogue === "string" ? catalogue.trim() : catalogue);
      catalogues.forEach((catalogue) => {
        if (typeof catalogue !== "string" || !allowedCatalogues.has(catalogue)) {
          errors.push(`${title || `Record ${index + 1}`} has an invalid catalogue: ${JSON.stringify(catalogue)}.`);
        }
      });
      if (new Set(catalogues).size !== catalogues.length) errors.push(`${title || `Record ${index + 1}`} catalogues must not contain duplicates.`);
    }
  }
  return { ...record, title, category, catalogues, validLinks };
}

function isInCatalogue(project, catalogue) {
  return project.category === catalogue || project.catalogues.includes(catalogue);
}

const projects = readProjects().map(normalizeRecord).filter(Boolean);
const homepageRanks = new Map();
for (const project of projects) {
  if (project.homepageRank === undefined) continue;
  const rank = Number(project.homepageRank);
  if (!Number.isInteger(rank) || rank < 1) {
    errors.push(`${project.title} homepageRank must be a positive integer.`);
    continue;
  }
  if (homepageRanks.has(rank)) errors.push(`Homepage rank ${rank} is shared by ${homepageRanks.get(rank)} and ${project.title}.`);
  else homepageRanks.set(rank, project.title);
}

const pageChecks = [
  {
    label: "/games/",
    predicate: (project) => isInCatalogue(project, "Games"),
  },
  {
    label: "/books/",
    predicate: (project) => isInCatalogue(project, "Books"),
  },
  {
    label: "/music/",
    predicate: (project) => isInCatalogue(project, "Music"),
  },
  {
    label: "/pocket-audio/",
    predicate: (project) => {
      const text = `${project.title} ${project.description || ""} ${(project.tags || []).join(" ")}`.toLowerCase();
      return (isInCatalogue(project, "Apps & Tools") || isInCatalogue(project, "Assets")) && text.includes("pocket");
    },
  },
  {
    label: "/apps/",
    predicate: (project) => isInCatalogue(project, "Apps & Tools") || isInCatalogue(project, "Assets"),
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

const whatWouldWin = projects.find((project) => project.title === "What Would Win");
if (!whatWouldWin) {
  errors.push("What Would Win is missing from data/projects.json.");
} else if (!isInCatalogue(whatWouldWin, "Games") || !whatWouldWin.validLinks.some((link) => link.url === "/apps/what-would-win/")) {
  errors.push("What Would Win must appear in Games and link to /apps/what-would-win/.");
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
