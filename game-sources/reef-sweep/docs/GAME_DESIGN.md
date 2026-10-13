> Historical design/handoff note. Current behavior and validation are in FEATURE_STATUS.md, BALANCE_RATIONALE.md and REVIEW_VALIDATION.md.

# Game design — Lantern Bay

## Identity

Reef Sweep is a persistent, first-person conservation/diving-business adventure. It is not a wave shooter, fishing action RPG, decompression simulator, or restaurant-management game. The enjoyable loop is seeing, understanding and carefully working in a beautiful place, then choosing what the outing means for the small business.

The three progress channels must remain distinct:

**Catch** pays for immediate operations. **Professional reputation** opens conservation support. **Audience** rewards interesting stories. Reef improvement is a fourth, physical outcome—not merely another currency.

The setting is fictional Caribbean waters. Lionfish are invasive in this setting, not universally “bad fish.” Native animals are not enemies to farm. A successful day can contain no predator confrontation at all.

## Pillars

### Learn a place

Authored landmarks and fixed major geometry make navigation learnable. The player can remember a ledge, a sand channel, a nursery and the mooring. Procedural dressing, fish positions/activity and changing site condition provide variety without erasing that memory. Revisit a planted fragment and it should be the same fragment in the same plot.

### Work with intention

A fish on the spear is physically different from a fish secured in the tube. Drawing, releasing and transferring are separate actions. Cleanup and planting need a brief deliberate hold near the work target, not a menu click across the map. The player identifies the target, positions, steadies, acts, and deals with the consequence.

### Leave room for life

Removal alone does not stand in for all conservation. Cleanup, restoration and observation matter. Native life should become more visible as a site improves. Healthy sites should eventually support monitoring, photography and funded maintenance rather than becoming economically worthless because fewer lionfish remain.

### Give danger an explanation

Air, distance, current and territory create tension. A warning means something actionable: head home, secure the catch, or move away. Do not use invisible damage, untelegraphed lethal encounters, animals pursuing forever, or attacks through geometry. Recovery from failure should preserve the desire to try tomorrow.

## Outing structure

At the harbour, select a site and one order. Choose owned gear implicitly; it is permanently available and no repetitive loadout ritual is required. The v0.2 preview has restaurant, cleanup, restoration and research contracts. The research contract asks for any two distinct shallow/deep field stations. Every dive starts with the profile's regulator-scaled air capacity, full battery and nursery stock. The base expenses are settled afterwards so an empty bank account never prevents play.

The dive begins near the mooring, already underwater. The player swims through a safe approach, learns the controls, finds reachable lionfish and sees cleanup work on the route. There is no random instant-danger start. A diver can ascend above the surface to look towards the coast; air use pauses while surfaced but does not refill. The intended active outing is roughly 8–12 minutes with standard equipment, plus a short debrief. This is a tuning goal, not a forced timer or a validated real diving profile.

The player chooses when to turn back. The home marker and chart keep that choice legible. Boarding requires being near the mooring and ascending into its upper interaction area. Do not replace a conscious return with automatic extraction at an arbitrary score threshold.

At the dock, allocate every landed fish exactly once. Sell to restaurants, keep a meal, or donate. Select up to two automatically captured highlight cards. Settlement applies operating expenses, contract success, conservation payments, audience growth, sponsorship conditions and event prizes. Gear and site progress persist.

## Swimming and presentation

The camera is eye-height in control terms, with chest-camera-style equipment framing. Forearms, gloves, spear and container supply physical presence. Neutral-depth assistance prevents continuous buoyancy correction, while acceleration, deceleration and currents make movement feel underwater.

Steady reduces movement; it does not freeze the diver against all water flow. A stronger fin kick increases exertion. The scooter is faster but consumes battery and must be stowed to hunt. Do not add breath-holding to the aiming controls.

The visible equipment may sway gently, but the horizon does not roll. Reduced-motion settings remove that sway. The initial arm models are a presentation layer, not full-body inverse kinematics. Their near-rock lowering is a conservative cosmetic hint, not an assurance that every possible pose is collision-perfect.

## Lionfish interaction

A fully drawn strike has approximately three game metres of reach. The balanced-spear upgrade increases useful reach and reduces draw time, not damage. A valid hit resolves a lionfish without a health-bar fight.

After a hit, the fish remains exposed. Hold Interact to transfer it. Marlow can take an exposed fish during his final approach; ordinary wildlife cannot subtract stored inventory. The tube starts at eight catches and grows with five upgrade ranks, reaching twenty. Lionfish contact damages health and drains air, with a cooldown to avoid repeated frame-by-frame damage. At capacity, the game refuses new strikes rather than creating an impossible collection state.

Strikes test the nearest relevant intersections. Reef obstacles stop a ray. A native fish physically in front of the target can produce a stewardship penalty. Detection radii deliberately favour usable controls over spine-by-spine precision. Final-art changes must not quietly change gameplay hit geometry.

## Wildlife

Marlow is a fictional recurring grouper with a usual territory. His role is familiarity mixed with uncertainty: he is sometimes an observer and sometimes a thief, not a pet or boss. No feeding menu, bribe economy or “train predators to solve lionfish” progression exists.

His state progression is roam, watch, approach, warning, lunge/theft, retreat and cooldown. Securing the fish, breaking visibility or leaving range interrupts the threat. The initial movement is local steering, not sophisticated 3D pathfinding; improve that implementation without changing the behavioural contract.

The moray is territorial. It warns, extends from its home position, and can make a defensive lunge if crowded. Normal mouth opening is not itself the aggression signal; text and additional approach behaviour carry the warning. The turtle and ray are peaceful encounters. A cautious reef shark appears during unlocked night dives, warns the diver and retreats; it is not a hunt target. Decorative schools supply life and context rather than challenge escalation.

## Persistent sites

Sunlit Gardens is the welcoming first site: two prominent entry coral heads, sand paths, the nursery, Marlow’s ledge, and a small arch. Tideglass Passage adds taller walls, a stronger channel and a larger arch. Both include a deeper trench with a wreck and old outfall survey stations. Passage unlocks after six removals or five reputation, so cleanup/restoration-focused players are not forced into a long hunting grind. These are new local field areas inside Lantern Bay, not additional regions.

Major rock volumes are authored. Dressing is generated once from the site seed. Habitat positions use deterministic seeds; later visits vary phases and weight. Removal records use stable IDs. A limited reinvasion cohort begins after repeated visits, rather than refilling the site whenever the camera turns away.

Rubbish stays removed. Planted coral stores the game day and gets larger on later visits. A survey station can be completed once per outing. New drifting-debris events, coral disease, storm damage, seasonal conditions and more sophisticated ecological recovery remain expansion work, not hidden features of v0.2.

## Business and advancement

Early catches cover air, fuel and upkeep. A modest upgrade after a useful first outing should feel attainable. The scooter is a clear early aspiration, nominally two to four productive outings depending on spending choices. Do not balance solely around perfectly efficient hunting.

Contracts distinguish sale, cleanup, planting and research objectives. Research pays for any two distinct field stations in an outing, including shallow plus deep or both deep stations; its bonus is higher at night. Completing one contract does not require completing every activity. Meal allocation offsets one modest expense; it is not a survival hunger system or a magical diving buff. Donations support reputation and community allocation. The debrief also offers an optional three-cut filleting activity: timing determines quality and adds up to 30% to fish actually sold. It never raises base fish values or changes the value of meals/donations; there is no cooking sequence.

Professional standing comes from careful work; audience comes from publishable moments. Repeated subjects earn diminishing follower growth. Sponsor conditions are explicit, fictional and bounded to one contribution per game day. Future sponsors should create choices and helpful support, not force reckless wildlife baiting for content.

Rescue loses the entire outing’s fish, keeps equipment and completed reef work, and adds an $85 expense. A negative balance becomes a bill, not a permanent lock. Future earnings gradually repay it. The player may always use basic gear and return to the initial site.

## Events

Every third in-game day, the Lantern Bay Sweep accepts an outing. It rewards removals, cleanup, restoration and surveys, with penalties for native-fish hits and reef contacts. Landing safely is required for a qualifying score. Prize tiers are visible before entry.

The initial leaderboard is personal-best history local to the save. It contains no fabricated human players. Real asynchronous competition would require a hosted service, score validation, privacy decisions and a clear owner-approved trust model.

## Art and audio direction

Use warmth, colour and charm with a believable underwater viewpoint. Avoid a blanket pixel filter, hyperactive screenshake and constant combat music. Realistic final creature anatomy should coexist with friendly, stylised reef colours and readable menus. The current procedural fish are first-pass placeholders with distinctive silhouettes.

Water should communicate depth, light and movement: surface shimmer, patterned sunlight, soft visibility falloff, restrained particles, moving vegetation and readable current zones. The expanded reef dressing adds abundant coral/seaweed and a coastline visible when the diver surfaces. Deep wreck/outfall silhouettes remain readable at night through the head torch. The reticle area needs clarity. Effects must scale without altering the game rules.

“Room for Life” is the original musical theme. It uses actual supplied Pocket Chordsmith instrument definitions and an editable PCS project. One clock drives shared harmony; focus and danger introduce layers instead of restarting songs. Simulation-timed regulator breathing and exhale bubbles are implemented in the v0.2 preview; their timing and mix still need validation in the combined build. Breathing and work sounds remain prominent. All critical cues also have visual/text equivalents.

## First-chapter boundary

The first chapter is deliberately compact: two sites, nine five-rank equipment types, four contract types, three coral plots per site, shallow and deep field stations, and a few characterful animals in an economic loop. The new wreck/outfall and night wildlife extend Lantern Bay rather than opening another region. Further regions and more species should be added only after swimming, spear feel, return navigation and physical-device performance are accepted.

An eventual chapter-completion milestone should celebrate both ecological results and a sustainable company. It should not demand eliminating every lionfish permanently or treat local removal as a solution to all ocean threats.
