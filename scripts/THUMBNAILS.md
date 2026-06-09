# Thumbnail refresh guide

This repository includes a local script to refresh project card images for
`data/projects.json` entries.

## Quick commands

- Refresh only missing thumbnails:

  ```bash
  npm run fetch:thumbnails
  ```

- Re-fetch all thumbnails (overwriting existing files):

  ```bash
  npm run fetch:thumbnails -- --force
  ```

## What the script does

- Reads `data/projects.json`.
- For each project, picks a best-effort source URL from the project links.
- Crawls page metadata and image tags to download a candidate image.
- Writes local files to `assets/thumbnails/`.
- Falls back to `assets/thumbnails/fallback.webp` when a project has no usable source image.
- Updates `data/projects.json` image paths (and `imageAlt` when needed).

## Recommended workflow

1. Install dependencies (if needed): `npm install`.
2. Run `npm run fetch:thumbnails`.
3. Review changed files:
   - `data/projects.json`
   - `assets/thumbnails/`
4. Commit only expected image/link updates.

## Notes

- Image URLs should remain local paths in `data/projects.json`.
- Avoid committing external hotlink URLs for thumbnails.
