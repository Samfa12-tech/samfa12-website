# Samfa12 Official Portal

This is a static portfolio website for `samfa12.com`, showcasing games, books,
Pocket Audio, music, and links for **Samfa12**.

## What this site includes

- `index.html` – compact homepage overview
- `games/index.html` – games catalogue
- `books/index.html` – books catalogue
- `apps/index.html` – Pocket Audio apps hub for browser-hosted tools
- `pocket-audio/index.html` – Pocket Audio family/workflow page
- `music/index.html` – music and audio catalogue
- `links/index.html` – full social/store/source links page
- `privacy/index.html` – analytics, signup, handoff, and external-platform privacy information
- `404.html` – branded GitHub Pages recovery page
- `styles.css` – dark, responsive styling and component styles
- `script.js` – data-driven rendering for the homepage and section pages
- `data/projects.json` – editable source of projects/cards
- Pocket Audio homepage strip linking Pocket Chordsmith, Pocket DJ, the source
  repo, and the full family page
- `apps/pocket-chordsmith/` – hosted single-file Pocket Chordsmith app route
- `apps/pocket-dj/` – hosted single-file Pocket DJ app route
- `assets/favicon.png` – browser/page icon derived from the Samfa12 character image
- `assets/samfa12-character.jpg` – Samfa12 character image used in the header brand mark
- `assets/og-image.png` – social preview image
- `assets/og-image-v2.png` – current 1200×630 social preview image
- `assets/thumbnails/` – local project card thumbnails
- `CNAME` – `samfa12.com` domain file
- `.github/workflows/pages.yml` – optional GitHub Pages deploy workflow

## How to edit projects

Update the file `data/projects.json`.

Each project entry has:

- `title`
- `category`
- `type`
- `status`
- `description`
- `tags`
- `featured` (`true`/`false`)
- `links` (array of `{ "label": "...", "url": "..." }`)
- optional homepage presentation fields:
  - `homepageRank` – positive integer used to order homepage picks
  - `homepageSize` – `hero`, `tall`, `wide`, or `standard`
  - `accent` – `cyan`, `violet`, `spark`, `green`, or `pink`
  - `imageFit` – `contain` when full art must stay visible, `cover` only when cropping is intentional

Project categories used by the data:

- `Games`
- `Books`
- `Apps & Tools`
- `Assets`
- `Music`
- `Social`
- `Storefronts`

The homepage intentionally renders only a small featured sampler. It chooses
projects from `homepageRank` first, then `featured`, then sensible fallback
ordering. Full project cards belong on the relevant section pages so projects
do not repeat across multiple homepage bands.

## Page shell conventions

When adding a new public site page, keep the shared Samfa12 brand treatment in
the header: the `.brand` link should include the `assets/samfa12-character.jpg`
image with class `brand-mark` immediately before the `Samfa12` text. New pages
should also use `/assets/favicon.png` for the browser/page icon and load the
current shared `styles.css` cache-busted URL.

## How to preview locally

Before previewing after project data changes, run:

```bash
npm run validate:catalogue
```

This checks that `data/projects.json` parses, key catalogue pages still have
records, local routes such as `/games/cursed-cutter/` exist, and unsafe card
URLs or thumbnail paths are caught before deploy. Missing thumbnail files are
reported as warnings because cards render text fallbacks when artwork is absent.

Option A: Simple Python server

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

## Shared cache versions

After changing `styles.css`, `script.js`, or `data/projects.json`, update the
shared cache key across the static pages:

```bash
npm run bump:cache -- 20260711-2
```

Use the current date plus an incrementing release number. The command updates
the shared stylesheet/script query strings and the project-data version used by
`script.js`.

## Analytics and privacy

Microsoft Clarity is opt-in. The shared site script shows an analytics choice,
stores the visitor's preference locally, and loads Clarity only after consent.
Visitors can reopen the choice through **Analytics preferences** in the footer.
Keep `/privacy/` accurate when signup providers, analytics, or the Pocket Audio
handoff retention period change.

Option B: VS Code Live Server

- Open the folder in VS Code.
- Right-click `index.html` and choose **Open with Live Server**.

## Sync hosted Pocket Audio apps

After releasing a new Pocket Chordsmith or Pocket DJ single-file build in the
Pocket Chordsmith repo, refresh the hosted app routes with:

```bash
npm run sync:pocket-apps
```

By default the script reads from:

`C:\Users\sam_s\Documents\Pocket Chordsmith`

It picks the newest matching single-file HTML in each app folder, writes it to
`apps/pocket-chordsmith/index.html` and `apps/pocket-dj/index.html`, reapplies
Samfa12 metadata/canonical tags, and refreshes the local Pocket Audio Core files
used by the hosted apps.

Optional overrides:

- `POCKET_CHORDSMITH_ROOT` – use a different Pocket Chordsmith repo folder
- `POCKET_CHORDSMITH_HTML` – use a specific Chordsmith HTML file
- `POCKET_DJ_HTML` – use a specific Pocket DJ HTML file

## Pocket Audio handoff relay

`apps/pocket-audio-handoff/` works as a static fallback with hash links, QR,
copy, and `.pcs1.txt` download. The phone-to-desktop short-code flow is backed
by a small Cloudflare Worker scaffold in `workers/pocket-audio-handoff/`.

The intended production flow is:

1. Phone opens Pocket Chordsmith and chooses Mobile transfer.
2. Chordsmith posts the PCS1 song to the relay and opens the handoff page with a
   short `SAM-...` transfer code.
3. Desktop opens `https://samfa12.com/apps/pocket-audio-handoff/`, enters the
   short code, then chooses Pocket DAW or Godot import actions.

Relay validation:

```bash
npm run test:handoff-relay
```

Local phone/debug smoke:

```bash
npm run dev:handoff
```

Open the printed `Phone/LAN` URL on the phone, for example:

`http://192.168.1.20:8787/apps/pocket-chordsmith/`

Then:

1. In Chordsmith, open Settings and tap Mobile transfer.
2. Tap Open samfa12.
3. Confirm the handoff page shows a short `SAM-...` code.
4. On the desktop, open
   `http://127.0.0.1:8787/apps/pocket-audio-handoff/`, enter that code, and
   confirm the PCS1 loads.
5. Use Copy for Godot or Open Pocket DAW from the desktop page.

The local dev server serves the static site and the relay API from the same LAN
origin, so phone tests do not need the Cloudflare Worker to be deployed first.

Production relay setup:

```bash
npx wrangler login
npm run setup:handoff-kv
npm run deploy:handoff-relay
RELAY_BASE_URL=https://pocket-audio-handoff.samfa12.workers.dev/api/pocket-audio-handoff npm run verify:handoff-live
```

Wrangler is Cloudflare's command-line deploy tool. The login step opens a
browser window for a Cloudflare account. After that, `setup:handoff-kv` creates
the short-lived transfer storage and updates `wrangler.toml`; `deploy:handoff-relay`
publishes the relay.

Do not use `wrangler deploy --temporary` for end-to-end handoff testing. A
temporary no-account Worker does not have persistent KV storage, so create and
redeem requests can land on different Worker instances and lose the transfer.

The static page defaults to
`https://pocket-audio-handoff.samfa12.workers.dev/api/pocket-audio-handoff`.
Change the page constant if the worker is deployed under a different route.

## How to enable GitHub Pages

### Option 1: Branch settings (recommended)

1. Go to GitHub repo **Settings**.
2. Open **Pages**.
3. Choose **Deploy from branch**.
4. Branch: `main`.
5. Folder: `/root`.
6. Save.

### Option 2: GitHub Actions workflow

If your workflow file exists (`.github/workflows/pages.yml`), pushing to
`main` will publish to GitHub Pages automatically.

## Domain setup (Porkbun) for GitHub Pages

For `samfa12.com`, keep the following records in Porkbun:

- Root/apex A records for `@`:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- CNAME record:
  - `www -> Samfa12-tech.github.io`

In GitHub Pages settings, set the custom domain to:

- `samfa12.com`

Then enable **Enforce HTTPS** (when available).

Pocket Audio handoff short codes do not require Porkbun DNS changes when using
the default `workers.dev` relay URL. Porkbun is only involved later if you want a
custom API hostname such as `handoff.samfa12.com`.

## Troubleshooting

- DNS can take time to propagate.
- Ensure `CNAME` contains only:
  - `samfa12.com`
- Ensure GitHub Pages has the custom domain field set to `samfa12.com`.
- Confirm Porkbun records match the list above.
- This site is hosted via GitHub Pages only. No paid hosting is required.

## Thumbnails

Thumbnails are optional. Cards must render cleanly without them. When a project
has artwork, store it locally under `assets/thumbnails/` and point the project to
`thumbnail` and `thumbnailAlt` in `data/projects.json`.

- Use local PNG/WebP/SVG files only. Do not hotlink remote thumbnails.
- Keep thumbnails at a 16:9 ratio for games/apps.
- Use a 4:5 ratio for books when possible.
- Leave `thumbnail` unset when no safe local asset exists yet.
- Example fields:
  - `"thumbnail": "assets/thumbnails/toknight.webp"`
  - `"thumbnailAlt": "Cover image for ToKnight"`

## Thumbnail maintenance

This repo includes a local thumbnail crawler to refresh card images from project
links.

- Refresh missing thumbnails only:

  ```bash
  npm run fetch:thumbnails
  ```

- Rebuild every thumbnail image from scratch (including already-existing files):

  ```bash
  npm run fetch:thumbnails -- --force
  ```

Notes:

- The script updates `data/projects.json` with any new local thumbnail paths it finds.
- If no valid image can be found, the project is left without a thumbnail so the
  card renders as text only.
- Review the generated diff before committing and push only after checking the
  updated thumbnails.

## Accessibility notes

- Keyboard focus styles are included for all interactive controls.
- External links open in a new tab with `rel="noopener noreferrer"`.
- The layout is mobile-first with responsive grids and readable typography.
