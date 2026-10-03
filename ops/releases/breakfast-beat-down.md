# Breakfast Beat-down browser release

The reviewed owner-supplied build is v0.2: Rush Hour Remix. All three supplied
packages contain the same HTML: 364,156 bytes, SHA-256
`a2b61eed4248a4daafa6b6012073ea83c46cc5959e064e9038eade837d9ac5d9`.

Import the standalone HTML with:

```powershell
npm run sync:breakfast-beat-down -- '<owner-supplied HTML path>'
npm run verify:breakfast-beat-down
```

The sync rejects any different source hash. It adds only a marked metadata
block: noindex/follow, a canonical pointing to the generated landing page,
and the shared favicon. The hosted HTML is 364,414 bytes with SHA-256
`e8b8c13e91fc62f969fe8a8b537ee2a2e7178a2f5a2b316d93c6a89fb429c352`.
The verifier removes the exact block and checks every remaining source byte.
The release route is protected against content-generator writes and Git
line-ending conversion. PR and Pages checks verify both the checkout and
staged public artifact.

Keep catalogue/editorial changes in the content model, then use the checks in
`ops/seo/README.md`. Publish only the hosted HTML and local thumbnail: source
ZIPs, QA output, soundtrack WAVs and working uploads belong outside this repo
or in excluded local output. No external sequel storefront was supplied.

The current WebP icon is 960x960, encoded from a new original 1254x1254 PNG
created with the built-in imagegen tool at the owner's request on 2026-10-03.
Sunny, mint headphones, a spatula and a gold rhythm ring echo the inspected
game artwork. The PNG master and prompt remain in private ignored output.
The public WebP filename contains its SHA-256 prefix to avoid stale artwork.
The original Breakfast Beat remains a distinct product.

Gameplay and storage are unchanged. Saves use `samfa12.breakfast-beatdown.v1`
and settings use `samfa12.breakfast-beatdown.settings.v1`. Browser storage is
origin-specific; the Pantry export/import flow is required to move a save from
another host. Audio starts from a user gesture. This integration does not
assert Android pack inclusion or an independent asset-rights review.

Future release bytes require an intentional provenance/hash update and review.
Use a dedicated branch and draft PR; merging main deploys the public site.
