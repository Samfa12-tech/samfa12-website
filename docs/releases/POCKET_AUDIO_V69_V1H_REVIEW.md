# Pocket Audio mirror review candidate

Source: Pocket-Chordsmith commit `66d228d219c1d7cfdbcb43201d93924af01e1f72`
([source PR116](https://github.com/Samfa12-tech/Pocket-Chordsmith/pull/116)).
Chordsmith v69 and DJ v1h include private Core 0.3.0. These are review candidates;
merging or deploying this branch remains a separate release decision.

The website branch starts from fresh main
`b2469ac41f721074868b89d1fbab9ccfea56e34f`. Its editorial content is preserved.
Only the two generated hosted app routes, the sync tool and these operator notes
change. The separately released Handoff route and Reef Sweep are untouched.

The existing sync tool copies the canonical app and Core files. Its `--apps-only`
option limits this sync to Chordsmith/DJ. Hosted pages point every Core loader
candidate at their adjacent bundled Core files, including localhost preview;
they no longer first request a missing monorepo-only IIFE. Head title, canonical
URL, description and icons retain the website's existing managed treatment.

Validation: content generator checks 68 outputs; SEO checks 51 product
dispositions/72 sitemap routes/seven catalogues; site and 64-record catalogue
checks pass. Local HTTP Chromium checks pass on desktop and touch emulation for
both actual hosted routes: Campfire project import, Core 0.3.0 manifest,
no autoplay, explicit Hear/Stop and unchanged source after Stop. No page errors
or failed local responses occur after the loader-path correction. The initial
404 failure is retained in the local evidence. Four screenshots and the JSON
summary are retained with the family candidate's release-preflight evidence.
This does not claim a physical phone, speaker route or human listening pass.

The family source separately passes Core213, Chordsmith browser155 with five
intentional phone genre-metric skips and cross-browser8, DJ browser94 plus
cross-browser6, and DAW source1235/106. Godot's intermittent ObjectDB gate and
runtime/performance acceptance remain open; its listing is not updated here.
No public upload, merge or deployment is performed by preparing this branch.
