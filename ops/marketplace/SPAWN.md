# Spawn Monday snapshot

The official authenticated endpoint is `GET https://www.spawn.co/api/agent/v1/me/numbers`, operation `readMyNumbers` in https://www.spawn.co/openapi.json. It covers games the agent makes or builds in, not necessarily every game owned by the linked human.

Use the existing authorized agent on its connected computer, NOT GitHub Actions. No credential is added to this repository, its workflows, GitHub Secrets or browser code. The saved agent token also has builder capabilities; no analytics-only scope has been verified.

Monday run (root assistant schedules this separately; do not duplicate the existing marketplace workflow):
1. Start from fresh current main in a clean worktree. Read AGENTS.md. Preserve concurrent changes.
2. Run `node scripts/update-spawn-stats.mjs`. It reads the existing Spawn client credential, keeps the raw response in memory, filters to Sam's six reviewed app IDs and writes only allowlisted aggregate fields. Never print the token, raw response or request headers. Do not create/reconnect credentials automatically.
3. Run `node --test tests/spawn-stats.test.mjs` and `node scripts/render-spawn-stats.mjs`, then `node scripts/render-spawn-stats.mjs --check`. Review exact sanitized diff.
4. Run repository content/site/catalogue/SEO tests and required release checks. Publish only the sanitized snapshot and generated shared release-card fragment following the established site release flow, preserving other changes and verifying deployment.
5. On offline/auth/network/schema/coverage failure, retain previous files, do not zero counters, do not claim freshness. Notify Sam only for a blocker needing him or repeated failure. Retry through the existing schedule, not duplicate schedules.

`data/spawn-stats.json` is separate from marketplace data so the existing Monday itch/Google Play workflow cannot overwrite it. The renderer reads the dated Wavedash snapshot and marketplace data too, keeping all platforms in one card grid without mixing their periods or metrics. No Wavedash counts or sales totals are altered. Do not add per-game players to claim unique people. Weekly boundaries/timezone and mixed live counters are not documented precisely; only provider all-time counters are shown, with provider as-of and capture date plus limitation. Do not publish revenue, account status, raw analytics or private identifiers. A new game requires explicit mapping review; losing a mapped game fails closed.

The static stats fragment supports JavaScript-disabled visitors. Do not hand-edit between SPAWN STATS markers; regenerate it. Routine refreshes do not bump unrelated pageModified dates.

## Unified release cards

All six platforms share the same static `data-marketplace-projects` grid; each release has its own platform-labelled card. Marketplace refresh and Steam/KDP importers regenerate it automatically; the Monday marketplace workflow commits stats/index.html with its JSON. Wavedash figures remain the explicitly dated owner-supplied rolling-period snapshot in data/wavedash-stats.json. Do not silently turn them into lifetime or November totals.

Six retired itch book listings retain their historical counters but have blank public URLs and a withdrawn status. The reconciliation helper retains these records even if the provider omits them; surviving Sober, Article 18, Backwater and Dust links are unchanged. No history rows or totals are deleted by the layout migration.
