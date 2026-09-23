# Samfa12 monthly search review — [YYYY-MM]

- Period: [start–end, complete days]
- Comparison period: [same length and search type]
- Sources/exported: [Search Console property, report, date; analytics source if used]
- Reviewer: [name/initials]

## Indexing and sitemap

| Measure | Current | Previous | Note or action |
| --- | --- | --- | --- |
| Indexed canonical pages | — | — | |
| Sitemap submitted / last read / errors | — | — | |
| Exclusions that need action | — | — | Record exact URL and reason; intentional exclusions are fine. |
| Technical audit routes / findings | — | — | Run `npm run audit:indexing -- --check`. |

## Search performance

| Measure | Current | Previous | Change / note |
| --- | --- | --- | --- |
| Impressions | — | — | |
| Clicks | — | — | |
| CTR | — | — | |
| Average position | — | — | Same filters; interpret as an average. |

- Top landing pages by impressions: [URL, current, previous, clicks, CTR]
- Top landing pages by clicks: [URL, current, previous, impressions, CTR]
- Pages with impressions but few clicks: [URL, query intent, possible page improvement]
- Pages with no impressions after a reasonable indexing period: [URL, first published, inspection result]

- Brand-query rule used: [exact terms/regex; review ambiguous terms]
- Branded queries: [query, page, impressions, clicks, CTR]
- Likely non-brand queries: [query, page, impressions, clicks, CTR]
- New or changed query-to-product matches: [query, page, evidence]

- External referral sources: [source, measured sessions/clicks, period and analytics method]
- AI/search referral traffic: [only where measurable; source and classification limits]
- Notable product actions: [consent-gated aggregate outbound events, if available; no sales inference]

## Decisions

- Technical fixes to investigate: [exact URL, evidence, owner, next check]
- Content/source refreshes to verify: [product ID, official URL, discrepancy]
- Intentional exclusions and unchanged pages: [brief reason]
- Changes shipped during the period: [PR/commit and exact pages]
- Next comparison date: [YYYY-MM-DD]

Use `—` for unavailable data. Do not fill gaps with estimated traffic, ranking, sales or AI-citation claims.
