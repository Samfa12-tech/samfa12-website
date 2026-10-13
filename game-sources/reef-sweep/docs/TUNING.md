> Historical design/handoff note. Current behavior and validation are in FEATURE_STATUS.md, BALANCE_RATIONALE.md and REVIEW_VALIDATION.md.

# Starting tuning and progression — v0.2 preview

All figures below describe **game abstractions**, not advice for actual diving, fishing or animal interaction. Values are exposed in the small source modules rather than a live tuning editor. Preview balance remains provisional; the separate progression fixture is an economic model, not a human campaign.

## Time and movement

| Variable | Initial value / rule | Location |
|---|---|---|
| Simulation step | 1/60 second; at most five catch-up steps | `main.ts` |
| Base fin speed | 2.2 game units/s | `simulation.ts` |
| Fins upgrade | ×(1 + 0.12 per rank), up to ×1.6 | `simulation.ts` |
| Strong kick | ×1.45 speed, more air expenditure | `simulation.ts` |
| Steady hover movement | ×0.42 | `simulation.ts` |
| Drawn spear movement | ×0.5 | `simulation.ts` |
| Scooter | 4.4 + 0.4 per rank, up to 6.4 units/s | `simulation.ts` |
| Velocity damping | 3; 7 while steady | `simulation.ts` |
| Diver rock padding | Approximately 0.5 game units | `simulation.ts` |
| Floor / surface clearance | Floor +0.85; surface +1.3. Above-water time pauses air consumption but does not refill air. | `simulation.ts` |
| Site current magnitude | Gardens 0.18; Passage 0.42, modulated channel/time field | `data.ts` |

The stated 8–12-minute aim is a **typical-play target**, not a fixed countdown. Route, depth, exertion, equipment and time spent working affect actual length. Initial automated testing does not establish full human-play pacing.

## Air, condition and battery

Air starts at a 200-unit fictionalised capacity. Regulator rank adds 30 capacity per rank after rank 1 (320 at rank 5); use per second is multiplied by `(1 − 0.09 × regulatorRank)`, on top of `0.24 × (1 + depth × 0.014) × exertion`. Strong kicks raise exertion; opposing current adds cost. Surfacing pauses use but never restores spent air. There is no decompression or gas-composition model.

Return reserve combines a 25-unit buffer with estimated route travel time, consumption and current. It is a game warning. Health starts at 100. Lionfish spine contact costs 9 health and 9 air, with a three-second injury cooldown; moray contact costs 22 health and air after a telegraphed warning. Air or health reaching zero initiates rescue.

Battery starts at 100. Scooter travel costs `0.28 / (1 + 0.35 × batteryRank)` per second; the light/head torch costs `0.065 / (1 + 0.2 × torchRank + 0.15 × batteryRank)`. An empty battery disables the scooter and leaves normal swimming available. It does not destroy the scooter or charge a new purchase price.

## Hunt and work

| Action | Rule |
|---|---|
| Full spear draw | `max(0.4, 0.8 − 0.08 × spearRank)` seconds |
| Minimum useful draw | 0.3 normalised charge |
| Reach | `3 + 0.45 × spearRank`, scaled by `(0.65 + 0.35 × charge)` |
| Strike cooldown | 0.75 seconds |
| Capacity | 8 base; `10 + 2 × tubeRank` after the first purchase, up to 20 |
| Secure fish | 0.65-second hold |
| Remove debris | 2.2-second hold |
| Plant nursery fragment | `max(1.3, 3.3 − 0.4 × kitRank)` seconds |
| Survey | 2.8-second hold |
| Board near mooring | 1.1-second hold |
| Work reach | Up to 4 units, aim agreement and clear line required |
| Fragments per outing | `3 + 2 × kitRank`, up to 13 |

Lionfish contact drains health and air together, so close approaches have a cost even before a spear strike. Do not present the simplified contact rules as animal-handling advice.

New strikes are blocked with a full tube. An exposed fish must normally be secured before other work. A fish left exposed at boarding/rescue is not landed catch. Removing a lionfish from the site persists even if its catch is subsequently stolen or lost.

## Wildlife

Marlow warns before committing to exposed-catch theft. Approximate warning commitment is 2.6 seconds, lunge speed 4.3, theft contact distance 1.8, then a substantial 20–25-second cooldown. Stowing the catch, breaking line of sight or making distance should resolve pressure.

The moray considers nearby intrusion around 3.6 units; sustained close approach within 2.6 after roughly 2.5 seconds can trigger a defensive lunge. Ordinary mouth opening is not the threat signal by itself. These are readable fictionalised state transitions, not validated behavioural prediction.

## Equipment

| Upgrade ID | Cost | Effect / prerequisite |
|---|---:|---|
| `fins` | 95 base | +12% speed per rank |
| `tube` | 120 base | Capacity scales to 20 at rank 5 |
| `spear` | 145 base | Faster draw and +0.45 reach per rank |
| `scooter` | 290 base | 4.4 + 0.4 units/s per rank |
| `air` | 190 base | +30 capacity after rank 1 and lower use per rank |
| `camera` | 155 base | +8 highlight quality per rank |
| `kit` | 110 base | +2 fragments and faster planting per rank |
| `battery` | 220 base | Reduced scooter/head-torch drain; requires scooter |
| `torch` | 320 base | Head torch and night dives; requires regulator rank 2 |

Every upgrade caps at rank 5. Later rank prices use the rank-specific cost multiplier from `upgradeCost`; old saves that only store an owned ID load as rank 1. `docs/progression-model.json` records a fixture that reaches most max ranks around outing 10 and all by outing 15. Its boundary assumes every field station is reached, catches are landed efficiently up to capacity, mean fillet quality is 75%, and there are no rescues or failed outings; it is not evidence of ordinary-player pacing.

Fresh career: $80, no debt, 12 followers. Purchases require cash, cannot be duplicated and cannot occur during active/pending dives. Tideglass Passage opens after six total removals **or** reputation 5. Site progression is not gated on audience.

## Settlement order and equations

Catch must be allocated exactly across Sell, Eat and Donate using non-negative integers. A stale or already-settled pending run cannot pay twice. Fish value is generated approximately as `round(14 + 17 × weight)`; these are fictional dollars.

Contract bonuses: sell four fish for the restaurant → $65; remove two debris items → $70; plant two fragments → $80; survey any two distinct field stations → $140 by day or $180 at night. Survey service pays $55 per station by day or $75 at night. Only the selected contract bonus pays. Rescue pays no contract bonus.

Stewardship increment:

```
care = max(0, removed×2 + cleaned×3 + restored×4 + surveyed×2
              − nativeHits×8 − coralHits)
reputation += floor(care/4) + donatedFish
```

This calculation can remove an outing's gain, but it does not subtract existing reputation. That distinction should be preserved in UI wording until a fuller misconduct system is designed.

Fillet bonus is `round(sales × filletQuality × 0.30)`, where quality is the mean timing score for three cuts. It applies only to allocated sales; it never changes each fish's base value, meal value or donation value. It is recorded once per finished non-rescue catch.

Income is sales + fillet bonus + qualifying contract + cleaned×12 + restored×15 + surveyed×55 (day) / surveyed×75 (night) + donated×3 + sponsor + event prize. Keeping at least one meal lowers normal expenses by $8; keeping additional meals does not stack fictional diving buffs. Night dives add $10 to ordinary expenses.

Normal expenses are `max(8, 28 + (Passage ? 10 : 0) + restored×6 − mealDiscount)`. Rescue expenses are $85. Negative balances become debt. Subsequent earnings repay a bounded share (up to 20% of earnings, available cash and outstanding debt). The game never requires a positive balance to launch basic work.

## Socials and sponsorship

At most two selected highlight cards are published. Audience gain per card is approximately `round(quality / (3 + 2 × priorPublicationsOfKind))`. Repeating one kind of clip becomes less valuable. The camera upgrade improves capture quality, not the resolution of the actual gameplay renderer.

At most one sponsor grant per game day. A conservation grant can pay $50 when reputation is at least 12 and the outing includes at least two cleanup/restoration actions. A wildlife-publication sponsor can otherwise pay $35 when audience is at least 80 and a Marlow/turtle/ray card is published. These are two first-pass deterministic rules, not negotiation contracts.

## Events

Events run every third **in-game** day. Local score is:

`removed×100 + cleaned×150 + restored×180 + surveyed×80 − nativeHits×300 − coralHits×40`

Rescue scores zero. Prize thresholds: 250 → $25, 650 → $65, 1200 → $120. Only local personal-best history is present. Records are bounded, with the most recent 60 retained. No online validation is implied.

## Reef progression

A displayed health index combines a base 24 with roughly `1.25×removed + 3×cleaned + 5×plantedPlots + 2×surveys`, capped at 98. It is a readable progress indicator, not a population-science estimate. Coral stages depend on game days since planting. Fine-grained fish-population dynamics, coral disease, real climate drivers and debris replenishment are not simulated.

Original target IDs and debris IDs remain cleared. After four visits, a few explicitly identified reinvasion targets become eligible. Do not restore all original targets to a pristine new spawn list just to keep sales high.

## First tuning pass to commission

Record five fresh-career play sessions per input mode. Measure time to first valid hit, first secure, first completed job, boarding success, money per outing, rescue frequency and scooter purchase timing. Separate problems caused by controls/visibility from economy problems. Do not adjust prices to compensate for a confusing collection interaction.
