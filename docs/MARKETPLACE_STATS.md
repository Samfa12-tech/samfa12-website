# Public marketplace statistics

The weekly **Samfa12 by the Numbers** update refreshes sanitised, lifetime
aggregate unit counts from itch.io and Google Play. Steam stays at an
owner-imported sanitised sales-CSV baseline, and Amazon KDP book figures are
also manually imported. This is separate from
the local Clarity/Cloudflare site-analytics bridge described in
[`ANALYTICS.md`](ANALYTICS.md).

The public data contains counts only: it never includes revenue, prices, tax,
currency, countries, customer information, order numbers, raw provider
responses, or credentials. `ops/marketplace/steam-state.json` is excluded from
the GitHub Pages artifact, but the repository is public, so that file is also
limited to sanitised dates, app IDs, unit counts, and the Steam changed-date
high-watermark.

Amazon/KDP is not automated. No KDP scraping, browser automation, cookies, or
stored browser sessions are used. A local import reads owner-downloaded KDP
workbooks and publishes only per-book net units and Kindle Edition Normalized
Page (KENP) reads.

## Public metrics

`data/public-stats.json` is the versioned public dataset consumed by the
homepage and `/stats/` dashboard. `data/public-stats-history.json` keeps
compact, sanitised snapshots for week-over-week changes and the dashboard's
aggregate trend. Current headline values are:

- itch.io: lifetime views, downloads, and purchases for published projects.
- Steam: gross, returned, and net **game units sold** from the latest
  owner-imported Steam package-sales CSV baseline.
- Google Play: gross paid-app purchases, fully refunded paid-app orders, and
  net paid-app purchases.
- Amazon KDP: per-book net units and KENP pages read from manually downloaded
  reports. Zero-price promotions are excluded from book sales.
- Across storefronts: paid units, currently itch purchases + Steam net game
  units + Google Play net paid-app purchases.

Paid units are storefront units, not unique people. Deltas may be negative when
Steam or Google Play corrects/refunds historical data. Revenue is never a public
metric.

The initial repository state is deliberately uninitialised until all three
providers complete a successful collection. The homepage hides the dynamic
section and `/stats/` shows a pending state rather than presenting placeholder
zeroes as real figures.

## Amazon KDP report import

Download the KDP royalty reports locally, then pass each report explicitly:

```powershell
npm run marketplace:import-kdp -- --report "C:\path\to\KDP_Prior_Month_Royalties.xlsx" --report "C:\path\to\KDP_Dashboard.xlsx"
```

The importer reads the `eBook Royalty`, `Paperback Royalty`, `Hardcover
Royalty`, and `KENP Read` sheets. It uses the separate sheets rather than
`Total Earnings`, so unit and page totals are not double-counted. The raw
workbooks stay outside the repository: review and commit only the updated
`data/public-stats.json`. The scheduled weekly marketplace update preserves the
sanitised KDP figures, but does not refresh them; rerun this local import when
new reports are available.

## Local configuration and commands

Copy `.env.marketplace.example` to the ignored `.env.marketplace` file. The
collector accepts a Google credential either as a local path or direct JSON:

```text
ITCH_API_KEY=...
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=/absolute/path/to/service-account.json
# Or: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={...}
# Copy this exact non-secret bucket URI from Play Console > Download reports > Financial.
# It resembles gs://pubsite_prod_rev_... (or an older pubsite_prod_... bucket);
# the collector derives the sales/ prefix when the copied URI is bucket-only.
GOOGLE_PLAY_SALES_URI=gs://pubsite_prod_rev_...
```

Do not modify, reuse, or put marketplace values in `.env.analytics`. Keep the
downloaded Google JSON outside this repository and remove unneeded copies from
Downloads/Desktop once it is stored deliberately.

```bash
npm run marketplace:check
npm run marketplace:update
npm run marketplace:verify-providers
npm run test:marketplace
npm run validate:catalogue
npm run validate:site
```

`marketplace:check` reports missing/invalid variable names without printing
values, then confirms that the Google service account can enumerate the
configured Financial sales reports before the updater calls the other providers.
`marketplace:update` refreshes itch.io and Google Play while retaining the
existing sanitised Steam baseline. It is atomic: an authentication, network,
parsing, or privacy-validation failure leaves the existing public data and
history unchanged. A valid zero is not an error.
`marketplace:verify-providers` checks itch.io and Steam only, reports
sanitised aggregate counters, and never writes state or public data. It is for
manual connection verification only; it is not part of the scheduled update.
The manual **Verify itch.io and Steam marketplace access** workflow also accepts
an optional `steam_debug_date` (YYYY-MM-DD). It requests that date's Steam
detail report read-only and logs only its sanitised gross, returned, and net
unit totals. Use it to compare a known date from Steamworks with API access;
it does not backfill or publish data.

Steam financial API access is not part of the scheduled update. When the owner
exports an authoritative Steam Sales CSV, the local import command below can
refresh the sanitised baseline. It reads the CSV outside the repository, retains
only direct `Steam` package unit counts, excludes `Retail` activations and all
financial/identifying fields, and resets the Steam high-watermark to `0` so a
future working API can authoritatively refresh the full history:

```bash
npm run marketplace:import-steam-csv -- --csv "C:\path\to\SteamSales.csv" --app-id 4419290
```

Review and commit only the resulting public data, history, and sanitised Steam
state—never the downloaded CSV. This baseline remains published until the next
owner-exported CSV import.

The collectors use official server-side/provider report APIs only. itch earnings
and Steam financial fields are discarded during normalisation. Google order
numbers are held only in memory while calculating paid-app purchase outcomes and
are never written or logged.

## GitHub Actions setup

The `Update public marketplace statistics` workflow runs on Sunday 21:00 UTC,
approximately Monday morning in Australia/Sydney, and can also be started from
**Actions → Update public marketplace statistics → Run workflow**. It serialises
runs, validates generated data before committing, and commits only changed
public datasets/history. The regular Pages workflow deploys the resulting
main-branch change; this workflow does not deploy Pages itself.

Create these two repository secrets in **GitHub → repository → Settings →
Secrets and variables → Actions**:

```text
ITCH_API_KEY
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

Also create the **repository variable** `GOOGLE_PLAY_SALES_URI` in **GitHub →
repository → Settings → Secrets and variables → Actions → Variables**. Copy its
value directly from **Play Console → Download reports → Financial → Copy Cloud
Storage URI**. It is a non-secret bucket identifier. Current docs show
`gs://pubsite_prod_rev_...`; older Play-issued `gs://pubsite_prod_...` values
are also accepted when copied from that Console. The collector appends the
required `sales/` report prefix for bucket-only URIs. The workflow never falls
back to a hardcoded bucket.

When Google Play access is still propagating, use **Actions → Verify itch.io
and Steam marketplace access → Run workflow** to test those two configured
secrets safely. This manual workflow has read-only repository permissions and
cannot commit or publish partial statistics.

### itch.io

1. Sign in to the Samfa12 itch.io account.
2. Open account settings, then the API keys area.
3. Generate an API key.
4. Create the `ITCH_API_KEY` Actions secret and paste it as its value.

itch API keys are powerful long-lived credentials. Treat one as a password: do
not commit, email, share, or print it.

### Steam (optional manual diagnostic)

1. Sign in to Steamworks with the Samfa12 partner account.
2. Open **Manage Groups** and create a **Financial API Group**.
3. Do not add apps or users to that group; it is the dedicated account-wide
   financial API mechanism.
4. Open the new group and obtain its Financial Web API key / **Manage WebAPI
   Key** value.
5. Create the `STEAM_FINANCIAL_API_KEY` Actions secret and paste it as its
   value.

This key is only required when manually running **Verify itch.io and Steam
marketplace access**. It is not used by the scheduled public-stats workflow.
Never email/share it. Valve recommends IP whitelisting Financial API keys, but
GitHub-hosted runners have no single permanent egress IP. Do not configure a
pretend/static GitHub Actions IP. Revisit IP whitelisting if this workflow moves
to a self-hosted runner or another runner with known static egress.

### Google Play

1. Open Google Cloud Console and use an existing suitable project or create a
   small reporting project for Samfa12.
2. Create a service account for the reporting job and download a JSON key.
3. Copy its service-account email address.
4. In Google Play Console, open **Users and permissions**, invite that email,
   and grant these permissions at **Global** scope:
   - **View app information and download bulk reports (read-only)**
   - **View financial data, orders, and cancellation survey responses**
5. Do not grant release, publishing, or administrator permissions.
6. Create the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` Actions secret and paste the
   complete JSON key contents as its value.

The report reader must use read-only Cloud Storage access. When an OAuth scope
is explicitly required, use:

```text
https://www.googleapis.com/auth/devstorage.read_only
```

Do not commit the downloaded service-account key. After successfully entering
the GitHub secret, delete unnecessary local copies and retain it only in the
credential store you deliberately chose.

If the workflow reports `storage.objects.list` denied, do not replace the
published figures with zeroes or remove Google Play from the update. Copy the
Financial Cloud Storage URI again, then check that the service account is
invited in Play Console and has both Global permissions above before rerunning
the workflow.

## Scheduled update

Once the two scheduled-workflow secrets are configured, run **Update public
marketplace statistics**. It retrieves published itch projects and all available
Google Play `salesreport_YYYYMM.zip` reports, retains the existing sanitised
Steam baseline, commits changed public data/history, and lets the normal Pages
workflow publish the update.
