import fs from "node:fs";
import path from "node:path";

function htmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.isFile() && entry.name.endsWith(".html") ? [file] : [];
  });
}

export function brokenHostedEntrypoints(siteRoot) {
  const missing = [];
  for (const directory of ["apps", "games"]) {
    for (const file of htmlFiles(path.join(siteRoot, directory))) {
      const route = `/${path.relative(siteRoot, file).replaceAll(path.sep, "/")}`;
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
        const reference = match[2];
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
        let destination;
        try {
          destination = new URL(reference, `https://samfa12.com${route}`).pathname;
          destination = decodeURIComponent(destination);
        } catch {
          missing.push(`${route}: invalid script entry point ${reference}`);
          continue;
        }
        const relative = destination.slice(1);
        if (relative.split("/").includes("..") || relative.includes("\\") || !fs.existsSync(path.join(siteRoot, relative))) {
          missing.push(`${route}: missing script entry point ${reference}`);
        }
      }
    }
  }
  return missing;
}
