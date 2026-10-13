# Campaign balance rationale

These numbers are bounded starting rules for the local campaign. They are supported by a deterministic economic fixture, not a natural player campaign or a balance claim for every play style.

## Progression and choices

The site gates keep professional reputation, removals, and followers separate. Passage opens at 6 removals or 5 reputation; Mangrove Reach at 12 or 8; Azure Cenote at 26 or 17; Rusted Harbour at 42 or 27. Each gate has a work-focused reputation route and a removal route. Followers do not unlock basic dive sites or research.

The research team becomes approachable at 8 reputation, then requires a separate conversation and explicit acceptance. A safe outing with four removals and one cleanup action produces 11 care points and 2 reputation, so four such outings reach the invitation threshold without relying on donations or followers. Existing schema-1 saves with survey history or an in-flight research outing are grandfathered.

Recognition assignments use both audience and reputation, then ask for a concrete story:

| Audience | Reputation | Assignment |
| ---: | ---: | --- |
| 80 | 4 | Publish a peaceful wildlife highlight. |
| 160 | 8 | Complete cleanup work and publish its highlight. |
| 300 | 17 | Return on a later day and publish a new highlight. |

Recognition records no cash. This gives audience milestones a visible purpose without turning followers into another payment or progression currency.

## Cash and work

The first safe sale pays a one-time $20 welcome grant, recorded by the `welcome-grant` character flag. Restaurant contracts pay $45 after four fish are sold; cleanup contracts pay $40 after two debris patches are removed; restoration contracts pay $45 after two fragments are planted. These bonuses require the selected objective. Ordinary work keeps its own pay: $12 per cleanup, $15 per planted fragment, and survey service pay. The no-contract option remains available.

The scooter’s first purchase rises from $290 to $420; other first-rank prices remain unchanged. Higher service ranks use the updated cost curve and field-experience gates described below. The opening fixture begins with $80, sells four $28 fish per outing, completes one cleanup while authored debris remains, and safely returns. Its first trip earns $189: $112 in sales, $45 contract pay, $12 cleanup pay and the $20 welcome grant. The $28 operating expense leaves $241. The next two equivalent trips each net $141; the player can buy the $420 scooter after outing three, leaving $103 before the next outing. The later Passage outings carry the existing $10 site expense.

Research service pays $18 the first time a station is surveyed and $6 for a repeat visit. Night adds $2 per station. The one-time funded assignment tops up station pay to an inclusive $65 by day or $72 at night. Repeat Monitoring tops up to $38 by day or $45 at night. The top-up prevents the assignment total from stacking on top of survey pay and gives repeat observation a lower guaranteed total. Passage's revision-two assignment also requires its two flow gauges; general research permits two distinct stations at other sites.

An abandoned boat encounter can be cleared once for $5. Sponsorship now pays no cash; recognition is earned through the assignments above. Local event prizes remain their own explicitly registered activity.

Normal expenses remain $28, plus $10 for Passage and $10 for a night dive, plus $6 per planted plot, less $8 when at least one meal is kept, with an $8 minimum. Rescue costs $85, preserves completed reef work and forfeits the outing's catch and contract bonus. A negative balance becomes debt; up to 20% of outing earnings pays it down. These rules keep failure recoverable and make night/Passage operations more costly without changing the beginner-site budget.

## Synthetic 12-outing fixture

`tests/polish-campaign-loop.test.mjs` uses the game APIs `startRun`, `Simulation.finish`, `settleRun`, `contractOptions`, and `buy`. It supplies repeatable test inputs of four live fish valued at $28 each and one cleanup when a permanent debris patch remains. It is an economic fixture, not human playtest evidence. Every outing selects the catch contract; one cleanup is side work and does not meet the two-item cleanup contract. The welcome grant applies only on outing one. Outing three's $523 cash is before the $420 scooter purchase; that purchase leaves $103.

| Outing | Site | Earned | Expenses | Cash after settlement | Reputation |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Gardens | $189 | $28 | $241 | 2 |
| 2 | Gardens | $169 | $28 | $382 | 4 |
| 3 | Gardens | $169 | $28 | $523 | 6 |
| 4 | Gardens | $169 | $28 | $244 | 8 |
| 5 | Gardens | $169 | $28 | $385 | 10 |
| 6 | Gardens | $157 | $28 | $514 | 12 |
| 7 | Passage | $169 | $38 | $645 | 14 |
| 8 | Passage | $169 | $38 | $776 | 16 |
| 9 | Passage | $169 | $38 | $907 | 18 |
| 10 | Passage | $169 | $38 | $1,038 | 20 |
| 11 | Passage | $157 | $38 | $1,157 | 22 |
| 12 | Passage | $157 | $38 | $1,276 | 24 |

The fixture moves from Gardens to Passage when fewer than four fish remain at Gardens for the selected order. Debris income stops after the site's authored patches have been cleared. The output is deterministic under the stated inputs; catch values, route choice, restoration, meals, donations, night operations, and player decisions change actual results. No physical-device, performance, or human-feel conclusion follows from this fixture.

## Full-rank pacing comparison

`tests/economic-pacing.test.mjs` compares the former rank multipliers `[1, .55, .7, .85, 1.05]` with the integrated `[1, .2, .25, .3, .4]` curve. First-rank prices stay as authored, and rank 2 has no service gate. Rank 3 opens on day 5 with 12 reputation, rank 4 on day 8 with 20 reputation, and rank 5 on day 11 with 28 reputation. At the v0.4 first-rank prices, the former service curve would total $7,350; the integrated `upgradeCost` API confirms $3,835 under the new curve. The fixture buys proposed upgrades using production `buy`, so its result covers the actual service gates and requirements.

Each strategy uses real seeded fish weights and the game's `14 + weight × 17` sale price, current tube capacity, five-site unlocks, actual settlement, four-fish contract thresholds, and one cleanup plus one coral plot where available. Fillets use a fixed assumed quality of 0.75 through `prepareFillets`, which models a 22.5% bonus on sales. This is a test input, not observed cutting performance or human play evidence. The table compares the former curve in an explicit baseline model with the integrated production APIs. It holds v0.4 payouts and route inputs constant, so it isolates service costs rather than recreating the full v0.3 economy:

| Strategy and curve | Fish sold | Fish sales | Assumed fillet bonus | Contract and work pay | Expenses | Rank 5 by outing 15 | Cash left |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Four-fish contract loop, old curve | 60 | $1,454 | $329 | $1,080 | $540 | Fins, tube, spear | $23 |
| Four-fish contract loop, integrated curve and gates | 60 | $1,454 | $329 | $1,080 | $540 | Fins, tube, spear, air, camera, kit | $98 |
| Fill current tube, old curve | 120 | $3,078 | $693 | $963 | $540 | Fins, tube, spear, air | $29 |
| Fill current tube, integrated curve and gates | 120 | $3,083 | $693 | $963 | $540 | All nine upgrades | $464 |

The four-fish route keeps all 15 outings productive and reaches rank 5 on six of nine items by outing 15 under the integrated curve. The $420 scooter and $220 battery stay at rank 0 under this deterministic purchase priority; players can choose to save for them earlier. Filling capacity clears the 120 seeded fish in 10 fishing outings. Under the integrated curve all nine upgrades reach rank 5 at day 11, after the tenth completed outing; five later outings have no catches and the permanent work is exhausted. This is an upper-bound harvest strategy, not a typical player pace. The gates hold the highest service ranks until day 11, but the result still depends on full cargo and the assumed fillet quality.

## Repeat-catch recovery after the authored stock

The previous three-fish return cohort fell below the four-sale contract threshold. Across 20 actual seeded fish from the five sites, average sale value is $24.70. With the assumed 0.75 fillet quality and no remaining permanent work, three returning fish project to about $74 in sales and $17 in fillet bonus, with no contract payment. The visit that catches them nets about $63 after its $28 base expense; three empty visits cost another $84, leaving the four-visit cycle down about $21. A four-fish cohort projects to $99 in sales, $22 in fillet bonus and the $45 catch contract; the visit plus three empty-dive expenses nets about $54 per cycle.

Production now returns four fish at the existing four-visit interval. The regression fixture starts from exhausted Gardens stock, checks the return contract after six visits, settles it through the real game APIs, and confirms permanent debris and coral remain exhausted. The four-fish cohort crosses the contract threshold without renewing work. The estimate excludes night and Passage surcharges or optional income, and it does not model catching difficulty or dive time.

+
+Existing schema-1 gear, ranks, cash and ecological work are retained. Old active/pending outings keep their original contract, survey, sponsor and event promises for one settlement; subsequent launches use the new rates. Prior research history continues to qualify without repeating the invitation. Actual browser actions earned reputation8 in the early productive loop, but its controlled positioning and accelerated time are not a natural pacing test.
+
+
+Major first purchases also need field experience: scooter day3/reputation4, head torch day4/reputation6 (plus regulator2). This protects the opening from a very thorough guided outing buying travel/night gear immediately. Owned legacy gear stays usable. If every permanent debris patch is already cleared, the 160-follower assignment accepts a new peaceful wildlife story from the recovering reef, preserving completed ecological work without respawning litter or paying cash.
+