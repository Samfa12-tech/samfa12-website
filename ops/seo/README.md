# Samfa12 search maintenance

This is an owner workflow, not a ranking score or a deployment dependency. The public sitemap is **https://samfa12.com/sitemap.xml**. `npm run audit:indexing -- --write` refreshes the machine-readable [indexing audit](indexing-audit.json); review its diff before committing. `npm run audit:indexing -- --check` checks the recorded audit against the checkout or `SEO_SITE_ROOT` staging directory. The Pages and PR jobs run that check after the normal content, site, SEO and protected-release checks. The report describes the site's HTML and links; it cannot say whether Google or Bing indexed a URL.

## Google Search Console

Use the verified `samfa12.com` property. In **Sitemaps**, submit `https://samfa12.com/sitemap.xml` once, then check its last-read status and errors after meaningful releases. Resubmit when the sitemap changes or Search Console reports a read problem; repeated submission does not force indexing. In **URL Inspection**, inspect the homepage and a representative changed game, book, music, app, reading-order and Updates URL. After a major release, useful examples include `/games/dust-on-the-river/`, `/books/dust-on-the-river/`, `/pocket-audio/pocket-chordsmith/`, `/books/the-broken-road/`, and `/updates/`. Check the user-declared and Google-selected canonicals, crawl and index status, last crawl, and rendered page. Use a live test to diagnose reachability; it does not predict Google's eventual canonical or indexing choice. See Google's [Sitemaps report](https://support.google.com/webmasters/answer/7451001) and [URL Inspection guide](https://support.google.com/webmasters/answer/9012289).

In **Page indexing**, “Discovered – currently not indexed” means Google knows the URL but has not crawled it; “Crawled – currently not indexed” means it was fetched but is not indexed. “Indexed” means included in Google's index, while an alternate or duplicate URL may correctly be excluded in favour of a canonical. Investigate unexpected noindex, fetch errors, wrong canonicals, missing internal links or thin/duplicate content. An excluded 404, intentional noindex or alternate URL is not automatically a defect. Do not treat a new page's indexing delay alone as proof of a website bug. Google's [Page indexing guide](https://support.google.com/webmasters/answer/7440203) explains the states.

In **Performance → Search results**, compare complete month against complete month using the same search type and filters. Record impressions, clicks, CTR and average position; position is an average, not a fixed rank. Review **Pages** to find product landing pages, then filter a page and open **Queries**; filter a query and open **Pages** to see which projects surface for it. Separate likely brand queries using a disclosed rule such as `samfa12`, `samfa 12`, and known spelling variants; review ambiguous terms manually. Compare high-impression/low-CTR pages with the page's actual title and intent, and record pages with no impressions only after a reasonable discovery period. Search Console data can be incomplete or grouped differently by site and page. See Google's [Performance overview](https://support.google.com/webmasters/answer/7576553) and [metric definitions](https://support.google.com/webmasters/answer/7042828).

No authorised Search Console export or API credential is present in this repository, so this workflow uses the [monthly report template](REPORT_TEMPLATE.md). Keep exports local and private. Do not commit them, stage them for Pages, or add Search Console credentials to the site. Only describe AI/search referrals when a measured source actually distinguishes them; neither a code change nor a Search Console impression establishes an AI citation or sale.

## Add a product

1. Confirm the exact product and format at official itch, Google Play, Steam, Amazon, Spotify, GitHub or first-party pages. Keep a game, book, soundtrack, pack, edition and platform build distinct.
2. Add one stable `id` and accurate links, description, category, catalogue membership and local artwork to `data/projects.json`. A card's `detailUrl` points to its first-party landing page; direct play, buy and download links remain direct actions.
3. Add the route, disposition, official sources and meaningful `pageModified` to `content/manifest.json`. If a page cannot be supported yet, use a documented hold instead of an empty template.
4. Record source identity and access in `content/source-review.json`; put unresolved differences in `content/SOURCE_GAPS.md`. Add sourced visitor copy to the correct editorial JSON file. Add FAQs only for genuine supported questions, and dated updates only for verified events with explicit date meaning.
5. Add relevant `relatedIds` and optional descriptive `relatedLabels`; use the existing reading-order hub model when the source supports an actual sequence. The generator rejects unknown or held relationship targets.
6. Run `npm run build:content`, `npm run check:content`, `npm run validate:catalogue`, `npm run validate:site`, `npm run validate:seo`, `npm run audit:indexing -- --write`, `npm run audit:indexing -- --check`, and `npm run test:content`. Review the generated HTML, sitemap, audit graph and full diff. The generator supplies the card link, product page, schema, breadcrumb and sitemap entry from the approved model; it does not invent prose.
7. Preview desktop, mobile, JavaScript-disabled and failed-fetch states. Run the protected-release verifiers. Use the normal branch/PR and Pages workflow; deployment requires the current task's authorisation.

## Refresh official sources and dates

Research is a separate review step; the Pages build never fetches storefronts or calls an AI API. Compare each exact source URL and edition/platform against approved copy. Record changed facts with claim-level sources, and distinguish a current store listing from an older devlog or planned date. Reconcile conflicting wording before editing. Preserve source provenance and genuine limitations; do not rewrite unaffected products. Update the affected content model, regenerate and review the diff before publication.

`pageModified` is explicit, not derived from build time or file mtime. Update only routes whose substantive visible content, structured data or contextual links changed:

| Change | Date source to review |
| --- | --- |
| Product description, FAQ, supported action or relationship | That product in `content/manifest.json` |
| Verified release/listing update | That product and `/updates/` in `content/site-routes.json` |
| Shared card title/description/artwork | Relevant catalogue page(s), plus `/` if featured; product if its page changes |
| Reading-order content or membership | Relevant hub in `content/hubs.json`, and a member page only if its content/link changes |
| About or other static marketing copy | Its `content/site-routes.json` entry |
| Marketplace statistics data refresh or routine build | No unrelated marketing page date; review `/stats/` only if its page content changes |
| Protected app/game release | Follow that release's guarded sync and verification workflow; update only genuinely changed site routes |

The generator rejects a dated product update newer than its product or Updates page modification date. `test:content` checks the explicit sitemap dependency. Google's [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) treats `<lastmod>` as the last significant page update and says submitting a sitemap is a hint, not an indexing guarantee.

## Monthly review

Copy [REPORT_TEMPLATE.md](REPORT_TEMPLATE.md) to a private monthly report. Compare like-for-like complete periods, record the source and export date, and leave unavailable metrics blank. Use [indexing-audit.json](indexing-audit.json) for technical route checks and `content/SOURCE_GAPS.md` for unresolved product claims. Review the 16 one-contextual-link advisories as editorial opportunities, not a quota for boilerplate cross-links. The existing Pocket Audio hub and reading-order hubs already answer distinct workflows; add a new indexable guide only when it has enough verified information not covered there.
