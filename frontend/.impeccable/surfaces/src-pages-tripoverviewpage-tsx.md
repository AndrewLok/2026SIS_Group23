---
version: 1
slug: "src-pages-tripoverviewpage-tsx"
primary_target: "src/pages/TripOverviewPage.tsx"
related_targets: ["src/styles/index.css","src/components/dashboard"]
---

Scope: the trip overview ("Panel" tab) only. Mode: Operate. The other screens keep the night instrument panel world unchanged.

Job: answer "what are we doing next" and "what do I owe" in under five seconds, then show whether anything needs the member. Every element must make sense at a glance; a dial exists only where a level is genuinely being read, and everything that is an alert rather than a level is a warning light.

User decisions (2026-10-05): classic analogue car cluster; green backlight to match the rest of the app; fuel gauge = trip budget left against the estimate; warning-light row for alerts; windscreen above the cluster, always gently driving, always night; crew shown in the rear-view mirror; dashboard only for now.

## Direction contract

THESIS: The overview is the driver's view of a classic analogue car at night: a windscreen with the road ahead, and a cluster of two chrome-ringed dials, a mechanical trip meter and a row of warning lights. It refuses the six-gauge grid: a dial is only drawn where a level is read, and alerts are lamps that stay dark until they are needed.

OWN-WORLD: Night road under a near-black blue sky, stars, hill silhouette, warm headlight pool, roadside posts and lane dashes rushing toward the glass. Australian green guide sign with white border and lettering. Rear-view mirror with chrome rim. Cluster cowl in dark grained plastic. Dials: brushed dark-chrome rings, black faces, green-backlit numerals and ticks, orange needles with a black chrome-rimmed hub, a faint glass reflection. Amber caution band, amber lamps. Odometer drums: black drums, green-lit digits.

STORY: A member opens the panel and sees the car moving through the night. The road sign says where the group goes next and when. The left needle leans to OWE or OWED, so direction is clear before the number is read. The fuel needle shows how much of the estimated budget is left. Any lit amber lamp is something waiting on them; tapping it goes there.

FIRST VIEWPORT (390 wide): top bar; windscreen strip about 210px tall with the mirror hanging at top centre holding the crew initials, the next-stop sign on posts at the right of the road. The cowl overlaps the windscreen's bottom edge. Inside it, BALANCE dial left and BUDGET (fuel) dial right, about 160px each; the trip-meter drums centred beneath ("018 · days to go"); the warning-light row across the cowl's base. SETTLE UP primary button directly under the cowl, in thumb reach. Desktop: windscreen about 300px tall, dials about 230px, trip meter between them.

FORM: classic analogue car instrument cluster with windscreen; user-pinned direction, no concept roll run; seed key: none (pinned). Signature interaction: the road scrolls toward the glass on transform-only perspective motion; on power-on the needles sweep and the odometer drums roll to their digits. Static under reduced motion; paused off-screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- The balance dial's range is ±the largest absolute balance in the group, so the needle shows where you stand relative to the group. Revisit if members find it confusing.
- The low-budget lamp lights at 15% of the estimate left or less, and when spending has gone over the estimate.
