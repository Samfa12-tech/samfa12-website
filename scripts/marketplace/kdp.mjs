import { strFromU8, unzipSync } from "fflate";

const XML_ENTITIES = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
const SALES_SHEETS = new Set(["eBook Royalty", "Paperback Royalty", "Hardcover Royalty"]);
const PAGES_READ_HEADER = "Kindle Edition Normalized Page (KENP) Read";

export function parseKdpWorkbook(bytes) {
  const files = unzipSync(bytes);
  const workbook = textFile(files, "xl/workbook.xml");
  const relationships = textFile(files, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(textFile(files, "xl/sharedStrings.xml", false));
  const targets = new Map([...relationships.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>(?:<\/Relationship>)?/g)].map((match) => [match[1], match[2]]));
  const sheets = [];

  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)) {
    const name = attribute(match[1], "name");
    const relationId = attribute(match[1], "r:id");
    const target = targets.get(relationId);
    if (!name || !target) continue;
    const normalizedTarget = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = textFile(files, normalizedTarget, false);
    if (xml) sheets.push({ name, rows: parseSheetRows(xml, sharedStrings) });
  }
  return sheets;
}

export function summarizeKdpSheets(workbooks, projectTitles = new Map()) {
  const books = new Map();
  for (const sheets of workbooks) {
    for (const sheet of sheets) {
      if (SALES_SHEETS.has(sheet.name)) collectSalesRows(sheet.rows, books, projectTitles);
      if (sheet.name === "KENP Read") collectPagesReadRows(sheet.rows, books, projectTitles);
    }
  }
  const projects = [...books.values()]
    .filter((project) => project.netUnits || project.pagesRead)
    .sort((left, right) => left.title.localeCompare(right.title));
  return {
    totals: {
      netUnits: projects.reduce((total, project) => total + project.netUnits, 0),
      pagesRead: projects.reduce((total, project) => total + project.pagesRead, 0),
    },
    projects,
  };
}

export function amazonProjectTitles(projects = []) {
  const titles = new Map();
  for (const project of projects) {
    if (!project || typeof project.title !== "string") continue;
    for (const link of Array.isArray(project.links) ? project.links : []) {
      const asin = /\/dp\/(B[0-9A-Z]{9})/i.exec(String(link?.url || ""))?.[1]?.toUpperCase();
      if (asin) titles.set(asin, project.title);
    }
  }
  return titles;
}

function collectSalesRows(rows, books, projectTitles) {
  const headerIndex = rows.findIndex((row) => row.includes("Title") && row.includes("Units Sold"));
  if (headerIndex < 0) return;
  const columns = headers(rows[headerIndex]);
  for (const row of rows.slice(headerIndex + 1)) {
    const title = canonicalTitle(row, columns, projectTitles);
    if (!title) continue;
    if (/^free\b/i.test(String(row[columns.get("Transaction Type")] || ""))) continue;
    const netUnits = columns.has("Net Units Sold")
      ? numberAt(row, columns, "Net Units Sold")
      : numberAt(row, columns, "Units Sold") - numberAt(row, columns, "Units Refunded");
    if (!Number.isFinite(netUnits)) continue;
    const book = getBook(books, title);
    book.netUnits += Math.round(netUnits);
  }
}

function collectPagesReadRows(rows, books, projectTitles) {
  const headerIndex = rows.findIndex((row) => row.includes("Title") && row.includes(PAGES_READ_HEADER));
  if (headerIndex < 0) return;
  const columns = headers(rows[headerIndex]);
  for (const row of rows.slice(headerIndex + 1)) {
    const title = canonicalTitle(row, columns, projectTitles);
    const pagesRead = numberAt(row, columns, PAGES_READ_HEADER);
    if (!title || !Number.isFinite(pagesRead)) continue;
    const book = getBook(books, title);
    book.pagesRead += Math.round(pagesRead);
  }
}

function canonicalTitle(row, columns, projectTitles) {
  const rawTitle = String(row[columns.get("Title")] || "").trim();
  if (!rawTitle) return "";
  const asin = String(row[columns.get("ASIN")] || "").trim().toUpperCase();
  if (projectTitles.has(asin)) return projectTitles.get(asin);
  const matchedTitle = [...new Set(projectTitles.values())].find((title) => rawTitle.localeCompare(title, undefined, { sensitivity: "base" }) === 0 || rawTitle.toLocaleLowerCase().startsWith(`${title.toLocaleLowerCase()}:`));
  if (matchedTitle) return matchedTitle;
  return rawTitle;
}

function headers(row) {
  return new Map(row.map((value, index) => [String(value).trim(), index]));
}

function numberAt(row, columns, header) {
  const value = Number(row[columns.get(header)]);
  return Number.isFinite(value) ? value : 0;
}

function getBook(books, title) {
  if (!books.has(title)) books.set(title, { title, netUnits: 0, pagesRead: 0 });
  return books.get(title);
}

function textFile(files, path, required = true) {
  const value = files[path];
  if (!value) {
    if (required) throw new Error(`KDP workbook is missing ${path}.`);
    return "";
  }
  return strFromU8(value);
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textFromXml(match[1]));
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = attribute(cellMatch[1], "r");
      const index = columnIndex(reference);
      if (index < 0) continue;
      const type = attribute(cellMatch[1], "t");
      const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] || "";
      cells[index] = type === "s" ? sharedStrings[Number(rawValue)] || "" : textFromXml(type === "inlineStr" ? cellMatch[2] : rawValue);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function columnIndex(reference = "") {
  const letters = String(reference).match(/^[A-Z]+/i)?.[0];
  if (!letters) return -1;
  return [...letters.toUpperCase()].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function attribute(source, name) {
  return new RegExp(`\\b${name.replace(/:/g, "\\:")}="([^"]*)"`).exec(source)?.[1] || "";
}

function textFromXml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, entity) => String.fromCodePoint(entity[0].toLowerCase() === "x" ? Number.parseInt(entity.slice(1), 16) : Number.parseInt(entity, 10)))
    .replace(/&([a-z]+);/gi, (_, entity) => XML_ENTITIES[entity.toLowerCase()] || "");
}
