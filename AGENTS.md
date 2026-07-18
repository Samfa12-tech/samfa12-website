# Agent Notes

## Project Shape

This repo is the static Samfa12 portal for `samfa12.com`. It is designed to run
on GitHub Pages from the repository root.

The main public site files are:

- `index.html` for the homepage shell
- `styles.css` for shared styling
- `script.js` for data-driven rendering
- `data/projects.json` for project/card content
- section pages under `games/`, `books/`, `music/`, `links/`, and
  `pocket-audio/`
- hosted app routes under `apps/`, including generated release copies for Pocket Audio and What Would Win

There is no bundler or framework for the main site. Keep changes static and
GitHub Pages-friendly unless the project is intentionally being migrated.

## Local Preview

Preview the site with a simple local server from the repo root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Common Commands

```bash
npm run fetch:thumbnails
npm run sync:pocket-apps
npm run sync:what-would-win
npm run verify:what-would-win-pages
```

`fetch:thumbnails` updates local thumbnail files and may edit
`data/projects.json`. Review its diff before committing.

`sync:pocket-apps` copies fresh single-file Pocket Chordsmith and Pocket DJ
builds from the current user's `Documents\Pocket Chordsmith` folder by default. Use
`POCKET_CHORDSMITH_ROOT`, `POCKET_CHORDSMITH_HTML`, or `POCKET_DJ_HTML` only
when intentionally overriding the source.

`sync:what-would-win` copies a completed build from the current user's
`Documents\What Would Win\app\dist` folder by default to
`apps/what-would-win/`. Use `WHAT_WOULD_WIN_ROOT` only when intentionally
overriding the source checkout, then run `verify:what-would-win-pages` before
release. The copied artifact must retain the source-generated
`legal-notices.txt` alongside its manifest, icons and social image.

## Editing Guidance

- Edit project listings in `data/projects.json`.
- Keep project thumbnails local under `assets/thumbnails/`; do not hotlink
  remote card images.
- Keep the shared brand treatment on new pages: the `.brand` link should include
  `assets/samfa12-character.jpg` with class `brand-mark` before the `Samfa12`
  text.
- New public pages should use `/assets/favicon.png` and the shared `styles.css`
  cache-busted URL pattern already used by existing pages.
- Preserve the `CNAME` file with only `samfa12.com` for GitHub Pages.
- Treat files under `apps/pocket-chordsmith/`, `apps/pocket-dj/`, and
  `apps/what-would-win/` as hosted release copies. Prefer updating them through
  their matching `npm run sync:*` command instead of hand-editing generated app
  HTML, CSS, JavaScript, or legal notices.

## Validation

For content/style changes, run a local HTTP preview and check the affected pages
in a browser. For data changes, confirm the homepage and relevant section page
both render without console errors. For thumbnail refreshes or hosted app syncs,
inspect the generated diff before committing.

## Git Hygiene

The `.codex-remote-attachments/` folder is local working material and should not
be committed unless the user explicitly asks for it. Do not overwrite unrelated
user changes in this repo.
