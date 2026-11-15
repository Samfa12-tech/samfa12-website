# Modern Web Guidance pass, 15 November 2026

Reference: https://github.com/GoogleChrome/modern-web-guidance

## Decision brief
Keep the static HTML/CSS/JS stack, local artwork, dark cyan/violet identity and existing fonts. The visitor job is finding a game or book and getting to its correct edition. Focus on navigation, discoverability, readable typography and input feedback rather than decorative dependencies or a redesign.

## Changes
- Search titles, descriptions, tags and platform labels in Games and Books, combined with existing filters/sort. Clear search preserves keyboard focus and restores the collection.
- Search also works against saved static cards when catalogue loading fails; without JavaScript the entire static catalogue remains available.
- Removed late mobile-menu focus resets which could override a visitor's keyboard navigation; close on desktop breakpoint rather than mouse-pointer detection.
- Consistent input/summary focus, 44px filter targets, stable scrollbar space, sticky-header anchor offset, balanced headings and progressive paragraph wrapping.
- Existing reduced-motion and forced-colour behavior retained; selected filters are explicit in forced colours.

## Validation
Content generation/check, catalogue/site/SEO/indexing checks and 81 content tests passed. Chrome desktop and 390px mobile inspected. Browser checks cover search, no matches, clearing, overflow, keyboard menu/Escape, no-JavaScript cards, failed-fetch search and reduced-motion preference. No screen reader or physical-device certification claimed.

Protected game/app assets unchanged. Reef's byte verifier initially reports index mismatch on Windows because the redirect source is CRLF and hosted copy LF; normalized text is identical. Using the canonical LF redirect source, the verifier passes for all 10 hosted files. No runtime file changes.

## Deliberate restraint
No blanket use of experimental browser features, added animation system, framework, tracking or hosted-game changes. Existing optional-analytics consent preserved. This is a tested polish pass, not a claim that every page meets a subjective AAA standard.
