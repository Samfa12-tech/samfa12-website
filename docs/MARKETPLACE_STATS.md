# Public marketplace statistics

The weekly **Samfa12 by the Numbers** update publishes sanitised, lifetime
aggregate unit counts from itch.io, Steam, and Google Play. It is separate from
the local Clarity/Cloudflare site-analytics bridge described in
[`ANALYTICS.md`](ANALYTICS.md).

The public data contains counts only: it never includes revenue, prices, tax,
currency, countries, customer information, order numbers, raw provider
responses, or credentials. `ops/marketplace/steam-state.json` is excluded from
the GitHub Pages artifact, but the repository is public, so that file is also
limited to sanitised dates, app IDs, unit counts, and the Steam changed-date
high-watermark.

Amazon/KDP is intentionally not automated in this stage. The data schema leaves
room for a future `amazon` source, but no KDP scraping, browser automation,
cookies, or stored browser sessions are used.

## Public metrics

`data/public-stats.json` is the versioned public dataset consumed by the
homepage. `data/public-stats-history.json` keeps compact, sanitised snapshots
for week-over-week changes. Current headline values are:

- itch.io: lifetime views, downloads, and purchases for published projects.
- Steam: gross, returned, and authoritative net **game units sold** from Steam
  package sales only.
- Google Play: gross paid-app purchases, fully refunded paid-app orders, and
  net paid-app purchases.
- Across storefronts: paid units, currently itch purchases + Steam net game
  units + Google Play net paid-app purchases.

Paid units are storefront units, not unique people. Deltas may be negative when
Steam or Google Play corrects/refunds historical data. Revenue is never a public
metric.

The initial repository state is deliberately uninitialised until all three
providers complete a successful collection. The homepage hides the dynamic
section rather than presenting placeholder zeroes as real figures.

## Local configuration and commands

Copy `.env.marketplace.example` to the ignored `.env.marketplace` file. The
collector accepts a Google credential either as a local path or direct JSON:

```text
ITCH_API_KEY=...
STEAM_FINANCIAL_API_KEY=...
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=/absolute/path/to/service-account.json
# Or: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={...}
GOOGLE_PLAY_SALES_URI=gs://pubsite_prod_7761853381809168545/sales/
```

Do not modify, reuse, or put marketplace values in `.env.analytics`. Keep the
downloaded Google JSON outside this repository and remove unneeded copies from
Downloads/Desktop once it is stored deliberately.

```bash
npm run marketplace:check
npm run marketplace:update
npm run test:marketplace
npm run validate:catalogue
npm run validate:site
```

`marketplace:check` reports missing variable names without printing values.
`marketplace:update` is atomic: an authentication, network, parsing, or privacy
validation failure leaves the existing public data, history, and sanitised Steam
state unchanged. A valid zero is not an error.

The collectors use official server-side/provider report APIs only. itch earnings
and Steam financial fields are discarded during normalisation. Google order
numbers are held only in memory while calculating paid-app purchase outcomes and
are never written or logged.

## GitHub Actions setup

The `Update public marketplace statistics` workflow runs on Sunday 21:00 UTC,
approximately Monday morning in Australia/Sydney, and can also be started from
**Actions → Update public marketplace statistics → Run workflow**. It serialises
runs, validates generated data before committing, and commits only changed
public datasets and sanitised Steam state. The regular Pages workflow deploys
the resulting main-branch change; this workflow does not deploy Pages itself.

Create these three repository secrets in **GitHub → repository → Settings →
Secrets and variables → Actions**:

```text
ITCH_API_KEY
STEAM_FINANCIAL_API_KEY
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

`GOOGLE_PLAY_SALES_URI` is intentionally configured in the workflow as the
non-secret value `gs://pubsite_prod_7761853381809168545/sales/`.

### itch.io

1. Sign in to the Samfa12 itch.io account.
2. Open account settings, then the API keys area.
3. Generate an API key.
4. Create the `ITCH_API_KEY` Actions secret and paste it as its value.

itch API keys are powerful long-lived credentials. Treat one as a password: do
not commit, email, share, or print it.

### Steam

1. Sign in to Steamworks with the Samfa12 partner account.
2. Open **Manage Groups** and create a **Financial API Group**.
3. Do not add apps or users to that group; it is the dedicated account-wide
   financial API mechanism.
4. Open the new group and obtain its Financial Web API key / **Manage WebAPI
   Key** value.
5. Create the `STEAM_FINANCIAL_API_KEY` Actions secret and paste it as its
   value.

This key can read financial reporting across the partner account. Never
email/share it. Valve recommends IP whitelisting Financial API keys, but
GitHub-hosted runners have no single permanent egress IP. Do not configure a
pretend/static GitHub Actions IP. Revisit IP whitelisting if this workflow moves
to a self-hosted runner or another runner with known static egress.

### Google Play

1. Open Google Cloud Console and use an existing suitable project or create a
   small reporting project for Samfa12.
2. Create a service account for the reporting job and download a JSON key.
3. Copy its service-account email address.
4. In Google Play Console, open **Users and permissions**, invite that email,
   and grant only:
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

## First successful run

No live collection is possible until the three Actions secrets exist. Once they
are configured, manually run **Update public marketplace statistics**. Its first
successful collection retrieves published itch projects, starts Steam at
high-watermark `0`, reads all available Google Play `salesreport_YYYYMM.zip`
reports, creates the first public dataset/history snapshot and sanitised Steam
state, commits them, and allows the normal Pages workflow to publish the update.
