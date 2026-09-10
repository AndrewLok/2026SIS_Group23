# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19 + TypeScript, single page app. Tailwind CSS v4 (CSS-first config; tokens live in `@theme` inside `src/styles/index.css`, there is no `tailwind.config.js`). shadcn/ui on Radix primitives. React Router v7 with nested routes under a trip layout. TanStack Query for all server-shaped data; React Context for session and active trip only. React Hook Form + Zod, with schemas shared with the data layer. date-fns. Lucide icons. Package manager is npm (Bun is not installed on the build machine, so the group's Bun-based `voyager/` app on the `frontend` branch is not a usable base).

Chosen by the user up front, not delegated.

## Users

Friends aged 18 to 35 planning a domestic road trip or a short overseas holiday, in groups of 4 to 8 people, taking one trip together.

They use it on a phone, while travelling, on patchy mobile data, often one-handed, and often late at night after a few drinks. The job they are doing is answering two questions fast: *what are we doing tomorrow* and *what do I owe*.

## Product Purpose

Replace the group chat plus spreadsheet plus screenshots mess with one place for ideas, dates, bookings and money.

Success is measured behaviourally: a member can open the app and answer "what are we doing tomorrow" and "what do I owe" in under five seconds each.

## Positioning

Group trips fall apart on two things — deciding what to do, and working out who paid for what. Both need to be visible to everyone at once, and neither is served by a chat log.

The mechanism a neighbouring app could not truthfully copy is the coupling of the two: ideas are proposed and voted on by the group, and an idea crossing half the current members is automatically promoted onto the shared calendar. Money follows the same rule — every expense splits evenly across all current trip members with no per-item haggling, so the split is a property of the group rather than a negotiation. Fuel legs are the single deliberate exception, splitting across riders only.

## Operating Context

- Phone first; layout widens at `md`. Never desktop-first.
- Used in transit and on unreliable connections. Loading, empty and error states are load-bearing, not decoration.
- One-handed, late-night use is the normal case, not an edge case.
- A trip is joined with a 6-character uppercase invite code, or a share link carrying that code.
- Group size 4 to 8. Every member sees the same state; there is no private view of shared money or plans.
- Currently front end only, running against a mock data layer that seeds a realistic demo trip. The group has a Spring Boot backend on a separate branch that is not wired up and does not yet cover most entities.

## Capabilities and Constraints

Confirmed capabilities: trips and membership, invite codes, itinerary idea voting, a shared calendar derived from agreed ideas and bookings, an expense log with even splits and settlement, fuel legs with restricted splits, flight and accommodation bookings entered by hand, group chat, and an estimated trip cost.

Confirmed constraints:

- Front end only for now. The mock data layer stays in the repo behind an env flag so the app demos with no backend running.
- No payment or transfer processing. Members settle up between themselves.
- No real bookings are made in the app, and nothing is validated against an airline. Members type their own flight details.
- No live flight tracking.
- Even splits only. Fuel legs are the one exception, splitting across the leg's riders.
- Money is integer cents everywhere, never floats. One `formatMoney()` helper.
- Dates are stored as ISO strings in UTC and formatted at render.
- IDs are strings throughout the front end; conversion to any other id type belongs in the mapper.
- Online-only. The app degrades gracefully on patchy data — small payloads, honest states, easy retry — but there is no offline mode, no service worker and no queued writes.

Explicitly undecided:

- The real backend target. The group's Spring Boot backend exists but has no ideas, votes, expenses, fuel legs or bookings; its `Trip` has no name, invite code or members; and its auth controller is a stub. Whether this app points at that backend or something else is a group decision that has not been made.

## Brand Commitments

- **Name: Voyager.** Confirmed by the user against repository evidence — the Java package is `com.voyager.backend` across 11 files on the `backend` branch, and both the `frontend` and `astrotest` branches build into a `voyager/` directory. The planning document's working title "Trip Planner" is superseded and should not appear in UI copy.
- **Voice:** plain and friendly, with no corporate tone. Money copy is blunt and unambiguous. Never guilt-trip anyone about what they owe.

No logo, wordmark, palette, typeface or other brand asset exists yet. None has been made binding.

## Evidence on Hand

There is no real evidence, and future work must not invent any:

- No real users, no testimonials, no case studies, no press, no usage data, no benchmarks. Nothing may be cited or implied.
- No pricing, licensing, deployment or availability claims are true. The product is a university group project and is not a shipped service.
- The only content is seeded demo data: one trip with 5 members, 8 ideas, 12 expenses, 3 fuel legs, 4 bookings and 20 messages. It is written to look realistic and must never be presented as real activity.

Repository: `AndrewLok/2026SIS_Group23`, branch `lf-mvp`, app in `frontend/`.

## Product Principles

1. **The two questions come first.** Every screen earns its place by helping someone answer "what are we doing next" or "what do I owe". Navigation is what is left over, not the point.
2. **Money is never ambiguous.** Exact cents, reconciling to the last cent, stated in plain words with a direction and a name attached. Blunt, never accusatory, never rounded into vagueness.
3. **The group decides; the app records.** Voting produces the itinerary. The app never decides on the group's behalf, and never hides how a decision was reached.
4. **One shared truth.** Everyone sees the same plans and the same money. Nothing private changes what someone else owes or where they are going.
5. **Say what it does not do.** Where a person might reasonably wait for a feature that is not coming, the boundary is stated on screen rather than left to be discovered.

## Accessibility & Inclusion

No formal standard has been mandated by the unit or the group, so the build holds a strong default bar: sufficient contrast, visible focus states, semantic structure, and full keyboard operability.

The product-specific requirements come from the confirmed operating context, and these are real constraints rather than nice-to-haves:

- **One-handed phone use.** Primary actions sit within thumb reach; nothing important lives in a top corner.
- **Late at night, sometimes after drinking.** Generous touch targets, no action requiring fine motor precision, and no destructive or money-moving action without an explicit confirm that names what will happen.
- **Low light and glare.** Contrast is held well above the minimum rather than at it.
