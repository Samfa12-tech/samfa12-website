# Indexing-readiness audit — 2026-09-23

The checked HTML contains **67 self-canonical indexable routes**, all present in the generated sitemap. The audit checks each route's title, description, canonical, index directive, initial content, local assets, JSON-LD, breadcrumbs and incoming links. It found **zero orphaned indexable routes** and **zero broken local assets**. The machine-readable [per-route report](indexing-audit.json) includes the 66 approved relationship edges derived from the content model and 16 pages with just one contextual incoming page. Those 16 are review opportunities, usually a category-card link; they are not a reason to add boilerplate links.

Two HTML routes are deliberately excluded from the sitemap: `/404.html` and the uncatalogued legacy `/george_goalie_game/`, both marked `noindex`. One pre-existing metadata gap remains on the protected `/games/bug-swarm/` play shell: it has no description. Its separate `/games/bug-swarm-guide/` has descriptive marketing content. Protected play/app shells are reported as runtime routes; the marketing H1 and JSON-LD requirements are not imposed on their interactive canvas/app markup. The audit does not claim that a search engine has indexed any URL.

Representative phone and desktop review found no broken artwork or horizontal overflow after a small mobile statistics-chart containment fix. The statistics page date changed because its visible phone layout changed; unrelated marketing dates did not move.

The Pocket Audio workflow is explained on its existing family page, and the three reading-order hubs already aggregate distinct book sequences. No additional thin directory or tag pages were justified. Source conflicts and edition limits remain recorded in `content/SOURCE_GAPS.md`; this audit did not turn unresolved storefront statements into new claims.

Run `npm run audit:indexing -- --write` after a substantive content change and review the JSON diff. PR and Pages checks compare the committed report with both the checkout and the actual Linux-staged site, while the separate SEO validator and release verifiers continue to check their own contracts.
