# Samfa12 daily social automation

This workflow publishes one curated Samfa12 post per day to the connected X/Twitter channel through Buffer.

It does **not** call Codex, ChatGPT Work, or an OpenAI API model during daily runs. The copy lives in `marketing/content-bank.json` and is selected by a small deterministic Node script.

## Safety model

Scheduled publishing is disabled by default. The daily workflow only publishes when the repository variable `SOCIAL_AUTOMATION_ENABLED` is exactly `true`.

The API key is read only from the GitHub Actions secret `BUFFER_API_KEY`. Never commit the key to the repository.

The initial automation targets X only. Facebook can be added later after the X workflow is proven.

## Files

- `marketing/content-bank.json` — curated public-safe posts, project/category metadata, and optional date windows.
- `marketing/posting-history.json` — records successful automated publishes so posts/projects can cool down.
- `scripts/social-post.mjs` — chooses content, discovers the X channel, and calls Buffer's GraphQL API.
- `.github/workflows/daily-social-post.yml` — daily and manual GitHub Actions workflow.

## GitHub setup

In the repository, open **Settings → Secrets and variables → Actions**.

### Secret

Create:

- `BUFFER_API_KEY` — the Buffer API key. The key should never be stored as a normal repository variable.

### Optional variables

- `BUFFER_X_CHANNEL_ID` — preferred once the correct X channel ID has been confirmed.
- `BUFFER_X_CHANNEL_NAME` — name hint used when auto-discovering the channel. Defaults to `Samfa12`.

Do **not** create `SOCIAL_AUTOMATION_ENABLED` yet.

## Test sequence

1. Merge the feature only after reviewing the content bank.
2. Add `BUFFER_API_KEY` as a GitHub Actions secret.
3. Run **Daily Samfa12 social post** manually with `dry-run`. It should print the selected post and make no Buffer call.
4. Run it manually with `list-channels`. Confirm the X/Twitter channel is the expected Samfa12 account and copy its channel ID into the repository variable `BUFFER_X_CHANNEL_ID`.
5. Run it manually with `draft`. Confirm an unscheduled draft appears in Buffer. Nothing should publish.
6. If the draft is correct, manually run `publish` once when ready. This shares immediately through Buffer and records the post in `marketing/posting-history.json`.
7. Only after the live test succeeds, add repository variable `SOCIAL_AUTOMATION_ENABLED=true`.

## Schedule

The workflow runs at `22:15 UTC`, which is approximately:

- 08:15 AEST
- 09:15 AEDT

GitHub Actions cron schedules use UTC, so the local clock time shifts by one hour with daylight saving.

## Content selection

The selector:

- respects `notBefore` and `notAfter` date windows;
- avoids reusing an exact post for 90 days by default;
- avoids the same project for 3 days by default;
- prefers changing content category from the previous post;
- validates that curated X copy is no more than 280 characters;
- uses a stable daily hash to choose among eligible posts, so a failed retry selects the same item that day.

A post can override defaults with `reuseDays` or `projectCooldownDays`.

## Buffer behavior

Manual `draft` runs create a Buffer draft using `saveToDraft: true`.

Manual `publish` runs and enabled scheduled runs use Buffer's `shareNow` mode. The script marks the post as AI-assisted because the initial copy bank was prepared with AI assistance.

## Updating the content bank

Add new items with a unique `id`, `project`, `category`, and `text`. Optional date fields use `YYYY-MM-DD`.

Keep claims public, current, and verifiable. Do not add private school, family, health, legal, or other non-Samfa12 context. Proposed game features should not be written as shipped features until verified.

The current bank is intentionally curated rather than generated daily. This keeps the daily automation free of OpenAI/Codex usage. It can later be replenished periodically from approved Samfa12 project material.

## API-key rotation

The current Buffer key expires after one year. Rotate it before expiry by generating a replacement in Buffer and replacing only the `BUFFER_API_KEY` GitHub Actions secret. No code change is required.
