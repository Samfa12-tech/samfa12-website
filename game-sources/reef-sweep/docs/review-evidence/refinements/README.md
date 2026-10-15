# Portrait refinement review evidence

All images are actual local Chrome renders of the canonical game. The initial captures reproduce the written issue; they are not the inaccessible owner JPEGs. Portrait/touch emulation and controlled placements are not physical-phone evidence.

| View | Before | Candidate |
| --- | --- | --- |
| Harbour, 390x844 | [Level selector](before-menu-390.png) | [Single helm launch](after-menu-390.png) |
| Cruising, 390x844 | [Large panel](before-boat-390.png) | [106-pixel panel; chart on demand](after-boat-390.png) |
| Dive, 390x844 | [Tube obstructs view](before-tube-390.png) | [Tube rotated below view](after-tube-390.png) |

[Portrait insertion with actual catches and Shishkabob](tube-insertion-390.png) shows the tube raised only during collection. [Short landscape boat](after-boat-844.png) and [dive](after-tube-844.png) retain the original landscape arrangement. [Desktop boat and seagulls](after-boat-1280.png) shows the restrained flock in normal gameplay.

[Portrait motion clip](portrait-collection.webm): native touch cancellation followed by actual two-fish insertion, empty-prong withdrawal and tube lowering. Controlled fish placement; the geometry and collection animation are actual gameplay.

[browser.json](browser.json) records all 92 focused assertions and zero page errors. [Deep interaction subset](deep-browser.json) records 19 passing checks and short desktop frame observations; [preparation and settlement](preparation-browser.json) records 16 passing checks. All three reports have empty page-error lists.
