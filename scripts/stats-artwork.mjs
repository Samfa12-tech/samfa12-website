import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const spawnArt = JSON.parse(readFileSync(new URL('../content/stats-artwork.json', import.meta.url), 'utf8'));
const aliases = {
  'backwater (vertical slice prototype)': 'book-backwater',
  'sober: a novel set in the world of drink (amazon)': 'book-sober',
  'briarhold: fortress defence': 'game-briarhold',
  'drink soundtrack': 'music-drink-ost',
  'drink original soundtrack': 'music-drink-ost',
};
const normalise = value => String(value).toLowerCase().replace(/\s*[:\-]\s*spawn edition$/i, '').replace(/\s*\(amazon\)$/i, '').replace(/[—–]/g, '-').trim();
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Match a product, not a storefront. Keep book/game editions distinct.
export function statsArtwork(title, platform, catalogue) {
  const name = normalise(title);
  const explicit = aliases[String(title).toLowerCase()] || aliases[name];
  const matches = catalogue.filter(project => normalise(project.title) === name);
  const project = explicit ? catalogue.find(project => project.id === explicit)
    : matches.find(project => platform === 'Amazon KDP' ? project.category === 'Books' : project.category !== 'Books') || (matches.length === 1 ? matches[0] : null);
  const asset = platform === 'Spawn'
    ? (spawnArt.find(entry => entry.projectId === project?.id)?.asset || (project?.id === 'game-red-line' ? project.thumbnail : null))
    : project?.thumbnail;
  if (!asset || !/^assets\/thumbnails\/[a-zA-Z0-9._-]+$/.test(asset) || !existsSync(fileURLToPath(new URL(`../${asset}`, import.meta.url)))) return null;
  return { src: `/${asset}`, projectId: project.id };
}

export function statsThumbnail(title, platform, catalogue) {
  const art = statsArtwork(title, platform, catalogue);
  // Decoration beside the visible title; fallback is intentionally not fabricated artwork.
  return art ? `<span class="stats-thumbnail"><img src="${escape(art.src)}" alt="" width="64" height="64" loading="lazy" decoding="async" /></span>`
    : '<span class="stats-thumbnail stats-thumbnail-fallback" aria-hidden="true">◇</span>';
}
