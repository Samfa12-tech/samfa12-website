# Briarhold public activity counters

## Meaning of the counters

Android downloads retain the existing GitHub Releases APK download total across
published Briarhold releases, including prereleases, repeat downloads and updates.

Browser plays are an **estimate from game-page requests**, not unique people or
confirmed gameplay starts. The public JSON is `data/briarhold-browser-stats.json`.
It covers the **previous seven complete UTC days**, with an explicit date range
and update date displayed on `/games/briarhold/`. It is not an all-time total.
The JSON period end is exclusive; the display uses the final included day.

The collector queries Cloudflare `httpRequestsAdaptiveGroups.count` for:

- Host `samfa12.com` only.
- Exact paths `/games/briarhold/play/` and `/games/briarhold/play/index.html`.
- End-user requests (`requestSource: eyeball`), method GET, status 200 or 304.

This excludes the promotional page, game assets, redirects, failed requests,
HEAD checks and internal Cloudflare subrequests. It includes repeat visits and
refreshes that reach Cloudflare. Automated traffic may remain; browser-cache or
offline loads may be absent. Adaptive sampling may estimate totals. No claim is
made that these are bot-free counts or confirmed successful game starts.

Do not substitute `sum.visits`: that metric measures arrivals from another
website or a direct link, not all game-page loads. Do not use the general
collector's truncated `topPaths` list or sum overlapping historical snapshots.
Each daily query has a half-open interval and the seven intervals do not overlap.
Seven complete days fit the eight-day retention documented in `ANALYTICS.md`.
Provider permission, schema or retention failures remain errors, never zeros.

## Automatic publishing

The GitHub Actions workflow **Update Briarhold browser statistics** runs daily at
01:17 UTC, when its workflow or collector changes on main, and on manual runs.
It tests the collectors/counters, reads
Cloudflare and commits only the sanitised public JSON. The existing Pages workflow
redeploys after this workflow succeeds; this is necessary because a commit made
using the workflow token does not itself trigger another push workflow.

Required repository Actions secret:

`CLOUDFLARE_API_TOKEN` — reuse the read-only analytics token described in
`ANALYTICS.md`. Never paste its value into code, issues, public JSON or logs.

Optional repository variable or secret:

`CLOUDFLARE_ZONE_ID` — with this configured, no zone lookup is needed. Otherwise
the existing zone lookup uses the token's Zone Read permission. The minimum
read-only permissions for the GraphQL aggregate query are **Account > Account
Analytics > Read** and **Zone > Analytics > Read**, restricted to the
`samfa12.com` zone; add **Zone > Zone > Read** only when the zone ID is omitted.
No Clarity token is required here.

Set the secret under the repository's **Settings → Secrets and variables →
Actions**, then run **Actions → Update Briarhold browser statistics → Run workflow**.
If the token is only in the computer's ignored `.env.analytics`, it is not
automatically available to GitHub Actions. No private credentials are committed.

## Existing local collection

`npm run analytics:collect` now also refreshes this public snapshot after saving
its normal private aggregate snapshot. The existing local automation can continue
to use that command. This updates a local file; publication still requires a
commit/push or the scheduled GitHub workflow.

To update only Briarhold (using the same ignored `.env.analytics` configuration):

```sh
node scripts/briarhold-browser-stats.mjs
node --test tests/briarhold-stats.test.mjs tests/briarhold-browser-stats.test.mjs
```

All seven queries must succeed and validate before an atomic file replacement.
A failed update preserves the last good snapshot. The browser displays its date
range, flags updates older than three days, and never converts missing data into
zero. The initial checked-in `pending` record means no verified total has yet
been published. Only aggregate counts and period metadata are public.

The generated release under `games/briarhold/play/`, the game code, Android
counter and Android release links are not changed by this feature.

## References

- [Existing analytics configuration and limits](ANALYTICS.md)
- [Cloudflare request counts and visits](https://developers.cloudflare.com/analytics/graphql-api/migration-guides/graphql-api-analytics/)
- [Cloudflare GraphQL filtering](https://developers.cloudflare.com/analytics/graphql-api/features/filtering/)
