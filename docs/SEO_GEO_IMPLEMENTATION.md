# SEO and product-page implementation review

Review date: 2026-09-23, Australia/Sydney. Base: `origin/main` at `b6e1047316ff2ec1dd2cd507962ad4d50aa3b99c`, the same revision and catalogue blob (`b9e6094e56e50aa8ad77d31f3de9922114d0713c`) cited by the supplied 22 September audit. The saved checkout was six stats/social commits behind this base; the implementation branch started from the remote base in a separate clean worktree.

## Before and after

| Area | Base | Prepared branch |
|---|---|---|
| Catalogue identity | 59 records, only Briarhold with a `detailUrl` | 59 stable IDs; 46 separate product identities and first-party pages; 13 directory/profile entries |
| Initial catalogue HTML | Most grids empty; four saved Games cards | Home and six section grids contain visible card text and real links before JavaScript; Links also has five pre-rendered link groups |
| Conditional fallback | Separate `fallbackProjects` contained Alpha.98 and a Dust novel preorder | No separate JavaScript marketing copy; failed fetch preserves generated cards |
| Product content | Briarhold and Handoff had useful existing pages; most products had no page | 44 new product pages; Briarhold and Handoff enhanced in place; 3 verified reading hubs, About and Updates |
| Updates | No shared sourced update model | 12 source-backed dated entries with event meaning and per-product anchors |
| Sitemap | 18 hand-maintained routes | 67 generated canonical routes with meaningful content dates |
| Pages upload | Release verifiers ran, catalogue/site checks did not gate upload | Content check, catalogue/site/SEO validation, unit suites and staged SEO check gate upload; protected artifact verifiers remain |

The full product dispositions and exact official links are in `content/manifest.json` and `content/source-review.json`. Claim-level sources live beside the copy in `content/game-app-copy.json` and `content/book-music-copy.json`. The remaining platform/status conflicts and source limits are listed in `content/SOURCE_GAPS.md`. The exact-ASIN Amazon listings for the Dust novel and three Broken Road books became readable in the owner's Chrome tabs during implementation; their public blurbs, edition labels and preorder dates support the resulting pages. Source review time is not used as a release date.

## Validation performed

- Before edits: `validate:catalogue`, `validate:site`, `verify:what-would-win-pages`, and `verify:briarhold-pages -- games/briarhold/play` all passed.
- After edits: `check:content`, `validate:catalogue`, `validate:site`, `validate:seo`, `test:content` (5), `test:analytics` (6), `test:marketplace` (22), `test:handoff-relay` (4), Briarhold statistics suites (39), and both protected artifact verifiers passed. The Briarhold verifier matched all 229 release files. `git diff --check` passed.
- A local staged-site simulation contained 617 public files, omitted content sources and development/private folders, and passed `SEO_SITE_ROOT=_site npm run validate:seo` plus What Would Win and Briarhold artifact verifiers. The actual Pages `rsync` step runs on Linux in the PR/deployment workflow; it was not executed on Windows.
- Playwright reviewed the homepage and Drink at desktop width, and 18 representative routes at a 360 px phone viewport: all returned one visible `h1`, no horizontal overflow and no page errors. Mobile menu, catalogue filtering (24 Games down to 3 Browser entries), keyboard skip-link focus, Article 18 FAQ disclosure and direct CTAs worked. JavaScript-disabled mobile Books retained 13 visible cards and working links; a forced 503 for `data/projects.json` kept the same card set and showed a retry status. The forced request produced the expected network error in the browser console, with no application exception.
- Seven existing routes were opened in a real browser and showed live app/game interfaces without page exceptions: Pocket Chordsmith, Pocket DJ, What Would Win, Pocket Audio Handoff, Briarhold play, Bug Swarm and Cursed Cutter. This is route/interface smoke evidence, not physical-device gameplay or sustained-performance evidence.
- Local and current live unknown URLs returned HTTP 404. Current live HTTP and `www` variants redirected to `https://samfa12.com/`; the apex returned 200. `robots.txt` still allows intended public crawlers and points to the canonical sitemap. No `noindex` or snippet suppression was introduced for product pages.

One local browser performance sample on `/books/` showed the initial HTML transfer growing from 7,635 to 26,270 bytes because it now contains all 13 cards. The same run measured DOMContentLoaded at 211 ms on the base checkout and 29 ms on the prepared checkout. These are local, sequential lab observations with cache and timing noise, not field Core Web Vitals or a measured production speedup.

Protected release copies and Android updater files were not changed. The PR branch prepares the Pages workflow; no production publish or external storefront edit was authorised or performed in this task.

Indexing decision: the existing play and hosted-app routes keep their own indexable canonical URLs and remain in the sitemap. The new guide/marketing pages have separate URLs and explain the products before linking directly to those runtimes. No runtime was redirected or marked `noindex` as a side effect.
