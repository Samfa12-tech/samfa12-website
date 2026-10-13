# PR28 release review

Sam authorised review and publication if ready after the draft was prepared.
The reviewed original head was `b081a61ea376277e942020673f94e369164b769a`;
main remained `bdb3a45622cd7295ba248270cf8b431fe455f2f9` during review.
The release uses the existing GitHub Pages workflow on main.

Two small schema-1 compatibility defects were reproduced and corrected:

- Loading old research outings adds an eligibility flag. Settlement incorrectly
  interpreted that migrated flag as new financial terms: a two-station day
  outing paid $65 instead of its promised $110 station pay plus $140 contract.
  Legacy terms now use the absence of the site/funding revision snapshots.
  Active and pending reloads, day/night rates and one-time settlement have
  regressions; future outings retain the current Monitoring terms.
- The renderer used the old Passage terrain for old saves while Simulation
  still used the new western mooring at x=-28. Simulation now resolves the same
  saved site revision, keeping the old visible mooring at x=0 boardable.

Fresh source checks: 165 tests, TypeScript checking, eight package tests, and
the ten-file source-to-hosted byte comparison passed. The release game.js
SHA-256 is `ec73e0947b6ef0feabcc9e5f15599e6b75f2eef908d71f0c14927c0fd3020896`.
Portal content/catalogue/site/SEO/indexing checks, content/analytics/shared-start/
marketplace/handoff suites, and protected Banana Ducky, Breakfast Beat-down,
What Would Win and Briarhold release guards passed.

An isolated headless Chrome process on Sam's laptop passed the 93 campaign/night
and 42 boat/recognition/controller/touch/privacy browser assertions. An additional
26 independent assertions covered actual v0.3 serialized active/pending saves,
legacy Passage boarding and financial terms, receipt reload, shipping-mode
keyboard startup/suspend/resume, disabled transport with granted consent, and
home/Games/Reef Sweep/Stats/privacy pages with and without JavaScript. Controlled
placement, surveys and synthetic Gamepad/touch are fixtures. Screenshots were
inspected; no physical phone or other task's desktop was used.

Analytics remains `{enabled:false, endpoint:''}`. The receiver/DO and production
counting are absent; presence of the client does not establish tracking. Backend
deployment, the approved same-origin route, explicit client activation, consent
and delivery/deduplication/aggregation validation are separate work.

Natural campaign pacing, physical touch/USB controller acceptance, Safari,
listening and sustained/thermal performance remain manual limitations. The
earlier short matched laptop GPU comparison remains in REVIEW_VALIDATION.md.
