# Samfa12 Official Portal

This is a static portfolio website for `samfa12.com`, showcasing games, books,
apps, Pocket Audio, music, and links for **Samfa12**.

## What this site includes

- `index.html` – compact homepage overview
- `games/index.html` – games catalogue
- `books/index.html` – books catalogue
- `apps/index.html` – apps and tools catalogue
- `pocket-audio/index.html` – Pocket Audio family/workflow page
- `music/index.html` – music and audio catalogue
- `links/index.html` – full social/store/source links page
- `styles.css` – dark, responsive styling and component styles
- `script.js` – data-driven rendering for the homepage and section pages
- `data/projects.json` – editable source of projects/cards
- Pocket Audio homepage strip linking Pocket Chordsmith, Pocket DJ, the source
  repo, and the full family page
- `apps/pocket-chordsmith/` – hosted single-file Pocket Chordsmith app route
- `apps/pocket-dj/` – hosted single-file Pocket DJ app route
- `assets/favicon.svg` – site icon
- `assets/og-image.png` – social preview image
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

Project categories used by the data:

- `Games`
- `Books`
- `Apps & Tools`
- `Assets`
- `Music`
- `Social`
- `Storefronts`

The homepage intentionally renders only a small featured sampler. Full project
cards belong on the relevant section pages so projects do not repeat across
multiple homepage bands.

## How to preview locally

Option A: Simple Python server

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

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
