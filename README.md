# Samfa12 Official Portal

This is a static portfolio website for `samfa12.com`, showcasing games, books,
apps, music, assets, and links for **Samfa12**.

## What this site includes

- `index.html` – all sections and layout
- `styles.css` – dark, responsive styling and component styles
- `script.js` – data-driven project rendering and filtering
- `data/projects.json` – editable source of projects/cards
- `assets/favicon.svg` – site icon
- `assets/og-image.png` – social preview image
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

Project categories used by the site:

- `Games`
- `Books`
- `Apps & Tools`
- `Assets`
- `Music`
- `Social`

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

## Accessibility notes

- Keyboard focus styles are included for all interactive controls.
- External links open in a new tab with `rel="noopener noreferrer"`.
- The layout is mobile-first with responsive grids and readable typography.
