import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const pocketRoot = process.env.POCKET_CHORDSMITH_ROOT
  ? path.resolve(process.env.POCKET_CHORDSMITH_ROOT)
  : path.join(os.homedir(), "Documents", "Pocket Chordsmith");

const pocketAudioCoreSource = path.join(pocketRoot, "packages", "pocket-audio-core");
const handoffSource = process.env.POCKET_AUDIO_HANDOFF_HTML
  ? path.resolve(process.env.POCKET_AUDIO_HANDOFF_HTML)
  : path.join(pocketRoot, "apps", "pocket-audio-handoff", "index.html");

const pocketAudioCoreImportBlock = `const POCKET_AUDIO_CORE_IMPORT_PATHS = [
  "./pocket-audio-core/src/index.js",
  "./pocket-audio-core/dist/pocket-audio-core.esm.js",
  "../../packages/pocket-audio-core/src/index.js",
  "../../packages/pocket-audio-core/dist/pocket-audio-core.esm.js"
];`;

const apps = [
  {
    name: "Pocket Chordsmith",
    sourceEnv: "POCKET_CHORDSMITH_HTML",
    sourceDir: path.join(pocketRoot, "apps", "chordsmith-web"),
    sourcePattern: /^pocket_chordsmith_.*\.html$/i,
    destinationDir: path.join(root, "apps", "pocket-chordsmith"),
    destinationFile: "index.html",
    description:
      "Pocket Chordsmith is a browser-based Samfa12 music sketchpad for chord progressions, song ideas, MIDI, export, and game-audio handoff workflows.",
    canonical: "https://samfa12.com/apps/pocket-chordsmith/",
    title: "Pocket Chordsmith | Samfa12",
    headLinks: [
      '<link rel="icon" href="./icon.png" />',
      '<link rel="apple-touch-icon" href="./icon.png" />',
    ],
    extraCopies: [
      {
        source: path.join(pocketRoot, "apps", "chordsmith-web", "icon.png"),
        destination: "icon.png",
        optional: true,
      },
    ],
  },
  {
    name: "Pocket DJ",
    sourceEnv: "POCKET_DJ_HTML",
    sourceDir: path.join(pocketRoot, "apps", "pocket-dj"),
    sourcePattern: /^pocket_dj_.*\.html$/i,
    destinationDir: path.join(root, "apps", "pocket-dj"),
    destinationFile: "index.html",
    description:
      "Pocket DJ is a browser-based Samfa12 live remixing tool for performing Pocket Chordsmith song ideas with pads, loops, builds, drops, and FX.",
    canonical: "https://samfa12.com/apps/pocket-dj/",
    title: "Pocket DJ | Samfa12",
    headLinks: ['<link rel="icon" type="image/svg+xml" href="../../assets/favicon.svg" />'],
    extraCopies: [],
  },
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function findLatestHtml(app) {
  const explicit = process.env[app.sourceEnv];
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!(await exists(resolved))) {
      throw new Error(`${app.sourceEnv} points to a missing file: ${resolved}`);
    }
    return resolved;
  }

  const entries = await fs.readdir(app.sourceDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !app.sourcePattern.test(entry.name)) {
      continue;
    }

    const filePath = path.join(app.sourceDir, entry.name);
    const stat = await fs.stat(filePath);
    candidates.push({ filePath, mtimeMs: stat.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!candidates.length) {
    throw new Error(`No ${app.name} HTML files found in ${app.sourceDir}`);
  }

  return candidates[0].filePath;
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeHeadManagedTags(html) {
  return html
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/<link\s+rel=["'](?:icon|apple-touch-icon)["'][^>]*>\s*/gi, "");
}

function patchHead(html, app) {
  let output = removeHeadManagedTags(html.replace(/\r\n/g, "\n"));
  const managedTags = [
    `<meta name="description" content="${escapeAttribute(app.description)}" />`,
    `<link rel="canonical" href="${escapeAttribute(app.canonical)}" />`,
    ...app.headLinks,
  ].join("\n");

  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(output)) {
    output = output.replace(/(<meta\s+name=["']viewport["'][^>]*>\s*)/i, `$1\n${managedTags}\n`);
  } else if (/<meta\s+charset=["'][^"']+["'][^>]*>/i.test(output)) {
    output = output.replace(/(<meta\s+charset=["'][^"']+["'][^>]*>\s*)/i, `$1\n${managedTags}\n`);
  } else {
    output = output.replace(/<head>/i, `<head>\n${managedTags}`);
  }

  if (/<title>[\s\S]*?<\/title>/i.test(output)) {
    output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttribute(app.title)}</title>`);
  } else {
    output = output.replace(/<\/head>/i, `<title>${escapeAttribute(app.title)}</title>\n</head>`);
  }

  return output;
}

function patchPocketAudioCoreImports(html) {
  if (!/const\s+POCKET_AUDIO_CORE_IMPORT_PATHS\s*=/.test(html)) {
    return html;
  }

  return html.replace(
    /const\s+POCKET_AUDIO_CORE_IMPORT_PATHS\s*=\s*\[[\s\S]*?\];/,
    pocketAudioCoreImportBlock
  );
}

async function copyPocketAudioCore(destinationDir) {
  const destination = path.join(destinationDir, "pocket-audio-core");
  await fs.mkdir(destination, { recursive: true });

  for (const dir of ["src", "dist"]) {
    const source = path.join(pocketAudioCoreSource, dir);
    const target = path.join(destination, dir);
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(source, target, { recursive: true });
  }

  for (const file of ["package.json", "README.md"]) {
    await fs.copyFile(path.join(pocketAudioCoreSource, file), path.join(destination, file));
  }
}

async function syncApp(app) {
  const source = await findLatestHtml(app);
  await fs.mkdir(app.destinationDir, { recursive: true });

  const rawHtml = await fs.readFile(source, "utf8");
  const patchedHtml = patchPocketAudioCoreImports(patchHead(rawHtml, app));
  const destination = path.join(app.destinationDir, app.destinationFile);
  await fs.writeFile(destination, patchedHtml, "utf8");

  for (const copy of app.extraCopies) {
    if (!(await exists(copy.source))) {
      if (copy.optional) {
        continue;
      }
      throw new Error(`Required file missing for ${app.name}: ${copy.source}`);
    }
    await fs.copyFile(copy.source, path.join(app.destinationDir, copy.destination));
  }

  await copyPocketAudioCore(app.destinationDir);

  return {
    name: app.name,
    source: path.relative(root, source),
    destination: path.relative(root, destination),
  };
}

async function syncHandoffApp() {
  if (!(await exists(handoffSource))) {
    throw new Error(`POCKET_AUDIO_HANDOFF_HTML points to a missing file: ${handoffSource}`);
  }
  const destination = path.join(root, "apps", "pocket-audio-handoff", "index.html");
  const [canonical, hosted] = await Promise.all([
    fs.readFile(handoffSource, "utf8"),
    fs.readFile(destination, "utf8"),
  ]);
  const style = canonical.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
  const main = canonical.match(/<main>([\s\S]*?)<\/main>/i)?.[1];
  const appScript = canonical.match(/<script>\s*(const HANDOFF_PARAM[\s\S]*?)<\/script>/i)?.[1];
  if (!style || !main || !appScript) {
    throw new Error(`Pocket Audio Handoff source does not contain the managed style, main, and app-script blocks: ${handoffSource}`);
  }
  const hostedStyle = `${style.trimEnd()}\n    body > .privacy-note{width:min(920px,calc(100vw - 24px)); margin:0 auto 42px}\n  `;
  let output = hosted.replace(/<style>[\s\S]*?<\/style>/i, `<style>${hostedStyle}</style>`);
  output = output.replace(/<main\s+id=["']main["']>[\s\S]*?<\/main>/i, `<main id="main">${main}</main>`);
  output = output.replace(/<script>\s*const HANDOFF_PARAM[\s\S]*?<\/script>/i, `<script>\n${appScript.trim()}\n  </script>`);
  await fs.writeFile(destination, output.replace(/\r\n/g, "\n"), "utf8");
  return {
    name: "Pocket Audio Handoff",
    source: path.relative(root, handoffSource),
    destination: path.relative(root, destination),
  };
}

async function run() {
  if (!(await exists(pocketRoot))) {
    throw new Error(
      `Pocket Chordsmith repo not found at ${pocketRoot}. Set POCKET_CHORDSMITH_ROOT to override.`
    );
  }

  if (!(await exists(pocketAudioCoreSource))) {
    throw new Error(`Pocket Audio Core source not found at ${pocketAudioCoreSource}`);
  }

  const synced = [];
  for (const app of apps) {
    synced.push(await syncApp(app));
  }
  synced.push(await syncHandoffApp());

  console.log("Synced Pocket Audio apps:");
  for (const item of synced) {
    console.log(`- ${item.name}: ${item.source} -> ${item.destination}`);
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
