# Samfa12 weekly social automation

This workflow prepares a week of curated Samfa12 X/Twitter posts in one GitHub Actions run, then lets Buffer publish them automatically at their scheduled times.

It does **not** call Codex, ChatGPT Work, or an OpenAI API model during the weekly GitHub run. The copy lives in `marketing/content-bank.json` and is selected by a deterministic Node script.

## Safety model

Automatic weekly scheduling is disabled until the repository variable `SOCIAL_AUTOMATION_ENABLED` is exactly `true`.

The Buffer API key is read only from the GitHub Actions secret `BUFFER_API_KEY`. Never commit the key to the repository.

The automation targets X only. Facebook can be added later after the X workflow is established.

## Files

- `marketing/content-bank.json` — curated public-safe posts, project/category metadata, and optional date windows.
- `marketing/posting-history.json` — records published and future scheduled items so posts/projects can cool down.
- `scripts/social-post.mjs` — chooses content, discovers the X channel, checks the Buffer queue, and creates posts through Buffer's GraphQL API.
- `.github/workflows/daily-social-post.yml` — despite the legacy filename, this is now the **Weekly Samfa12 social schedule** workflow.

## GitHub setup

In the repository, open **Settings → Secrets and variables → Actions**.

### Secret

- `BUFFER_API_KEY` — Buffer personal API key.

### Optional variables

- `BUFFER_X_CHANNEL_ID` — locks the workflow to one specific X channel. The tested Samfa12 Buffer channel can also be auto-discovered by name.
- `BUFFER_X_CHANNEL_NAME` — name hint used when auto-discovering the channel. Defaults to `Samfa12`.
- `SOCIAL_AUTOMATION_ENABLED` — set to `true` only after manual weekly scheduling is tested.

## Manual actions

The workflow exposes these manual modes:

- `preview-week` — prints the next seven candidate posts and dates without contacting Buffer.
- `schedule-week` — schedules the following seven daily slots in Buffer.
- `dry-run` — previews one post only.
- `list-channels` — lists connected Buffer channels.
- `draft` — creates one unscheduled Buffer draft.
- `publish` — immediately publishes one post and records it in history.

## Weekly schedule

The GitHub workflow runs at **09:00 UTC every Sunday**, which is:

- 19:00 Sunday AEST
- 20:00 Sunday AEDT

It then schedules one X post per day for the following seven days, normally Monday through Sunday, at **08:15 Australia/Sydney local time**. The script converts each local slot to UTC individually, so the publishing time stays at 08:15 across daylight-saving changes.

Buffer scheduled posts use `mode: customScheduled` with a future `dueAt` value.

## Existing Buffer posts

Before creating the weekly batch, the script reads future scheduled posts for the Samfa12 X channel. If Buffer already has a scheduled post on one of the target dates, the automation skips that date instead of adding a second automated post.

A manually saved **draft** does not block a date because it is not scheduled.

Re-running `schedule-week` is therefore designed to be reasonably safe: dates already occupied in Buffer are skipped.

## Content selection

For each target date the selector:

- respects `notBefore` and `notAfter` date windows;
- avoids reusing an exact post for 90 days by default;
- avoids the same project for 3 days by default;
- prefers changing content category from the previous selected/published item;
- applies those cooldowns across the seven posts being planned in the same batch;
- validates that curated X copy is no more than 280 characters;
- uses a stable hash of date + post ID so the same date produces a reproducible choice while the history is unchanged.

A post can override defaults with `reuseDays` or `projectCooldownDays`.

## Posting history

Immediate manual `publish` entries are recorded as `published`.

Weekly batch entries are recorded as `scheduled` as soon as Buffer accepts each post, including their Buffer post ID and `dueAt` timestamp. The workflow commits this history back to the repository after the run. The history-commit step uses `always()` for weekly scheduling so successfully created posts are still recorded if a later item in the same batch fails.

## Recommended weekly operating loop

1. During the week, keep working normally on Samfa12 games, books, web tools, releases and development.
2. Before the Sunday GitHub run, refresh `marketing/content-bank.json` with any worthwhile new public-safe material.
3. Sunday evening Sydney time, GitHub schedules the next seven daily posts into Buffer.
4. Buffer publishes them during the week without GitHub, Codex, Work or ChatGPT needing to run each day.

This makes a weekly ChatGPT content-bank refresh a good companion workflow: ChatGPT can review recent Samfa12 work, propose or add new evergreen/current entries, while GitHub + Buffer handle publication.

## Updating the content bank

Add new items with a unique `id`, `project`, `category`, and `text`. Optional date fields use `YYYY-MM-DD`.

Keep claims public, current, and verifiable. Do not add private school, family, health, legal, or other non-Samfa12 context. Proposed game features should not be written as shipped features until verified.

The content bank should be larger than a single week so the weekly job remains resilient if a replenishment is missed.

## API-key rotation

The current Buffer key expires after one year. Rotate it before expiry by generating a replacement in Buffer and replacing only the `BUFFER_API_KEY` GitHub Actions secret. No code change is required.
