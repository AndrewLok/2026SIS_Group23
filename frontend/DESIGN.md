---
name: Voyager
description: A night instrument panel for a shared trip — dark, achromatic, and readable at a glance in a car at 2am.
colors:
  panel: "#0b0d0f"
  face: "#0f1114"
  face-raised: "#14171b"
  bezel: "#2a2d31"
  bezel-edge: "#3a3e44"
  luminous: "#f2f5f5"
  placard: "#93a0a5"
  radium: "#7cff9e"
  caution: "#ffb000"
  warning: "#ff3b30"
typography:
  display:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "font-stretch: 82%"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
    fontVariation: "font-stretch: 92%"
  value:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
    fontFeature: "tnum 1, zero 1"
  # 12px is the floor for anything a person can tap. This tier is the one
  # deliberate exception: non-interactive annotations sitting beside something
  # already legible - weekday heads, a day divider, a message timestamp, a
  # fieldset legend, a FOR/AGAINST marker. Nothing interactive may use it.
  caption:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.12em"
    fontVariation: "font-stretch: 92%"
  # shadcn's own control size, shipping in Button and Calendar. Recorded because
  # it is on screen, not because it was chosen: those files belong to the CLI and
  # are themed through the CSS variables rather than edited.
  control:
    fontFamily: "Saira Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "0.125rem"
  md: "0.25rem"
  lg: "0.375rem"
  xl: "0.5rem"
  full: "999px"
spacing:
  1: "0.25rem"
  1.5: "0.375rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.radium}"
    textColor: "{colors.panel}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "{colors.radium}"
    textColor: "{colors.panel}"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.luminous}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    textColor: "{colors.placard}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    textColor: "{colors.warning}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.luminous}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  plate:
    backgroundColor: "{colors.face}"
    textColor: "{colors.luminous}"
    rounded: "{rounded.md}"
    padding: "1rem 1.25rem"
  placard:
    textColor: "{colors.placard}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  category-badge:
    textColor: "{colors.placard}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  reading-strip:
    backgroundColor: "{colors.face}"
    textColor: "{colors.radium}"
    rounded: "{rounded.md}"
    padding: "1rem 1.25rem"
  section-tile:
    backgroundColor: "{colors.face}"
    textColor: "{colors.luminous}"
    rounded: "{rounded.md}"
    padding: "1rem"
  nav-item:
    textColor: "{colors.placard}"
    typography: "{typography.label}"
    padding: "0.5rem 0.25rem"
    height: "3.5rem"
  nav-item-active:
    textColor: "{colors.radium}"
---

# Design System: Voyager

## Overview

**Creative North Star: "The Night Instrument Panel"**

Voyager is read in a car at night, by someone who has ten seconds and one thumb. So the app is not a dashboard that borrows gauge imagery; it is an instrument panel with working instruments. Every reading is a real gauge with a tick scale, a caution band, a filled arc and a needle that damps rather than snaps. Every container is a plate bolted to the panel, with visible corner fixings, a satin bezel that catches light along its top edge, and a fine matte texture over the fill. The materials come first, and the layout is what fits between them.

The field is achromatic on purpose, and that is the load-bearing decision of the whole system. Panel, face, bezel and placard are all tinted off one hue and none of them is a pure grey or a pure black. Against that field there are exactly three chromatic signals with fixed meanings: radium green is a live reading, caution amber is a figure that wants your attention, warning red is destructive only and never decorates. Because nothing else on screen carries chroma, a single amber needle is impossible to miss. The moment a fourth colour appears — a category palette, a chart hue, a brand accent — the signal system stops working.

The app is dark only, by explicit decision. There is no light theme and no `.dark` class to toggle: `:root` carries `color-scheme: dark` and the palette directly. A light mode would not be a variant of this world, it would be a different world. Density is high and rhythm is tight (a 0.75rem–1rem gap dominates), corners are machined rather than soft (0.25rem base radius), and the app spends its one authored motion moment on the power-on self-test sweep when the panel comes alive.

**Key Characteristics:**
- Dark only; no light theme, no theme toggle.
- Achromatic field, three fixed-meaning signal colours.
- Real gauges with scales, bands, needles and damped travel.
- Plates with fixings, texture and a lit bezel edge — never flat cards.
- Uppercase letterspaced placards that sit *under* what they name.
- Measurements set in tabular mono; readings in condensed instrument numerals.

## Colors

One achromatic field tinted off a single cool hue, plus three signal colours that never change meaning.

### Primary
- **Radium Green** (`{colors.radium}`): The live-reading colour. Normal gauge arcs, needles and hubs; the value text on a normal reading; the active bottom-nav item; focus rings, caret, and text selection; primary button fill (with panel-dark text on top); positive money (owed to you). It carries phosphor glow when it renders a reading.

### Secondary
- **Caution Amber** (`{colors.caution}`): A figure that wants attention, never a scold. The caution band on a dial, an amber needle and reading, negative money (owing), and form-field error text. It is earned, not ambient: the voting gauge goes amber only when an idea is waiting on *your* vote, because a signal that is always on is not a signal.

### Tertiary
- **Warning Red** (`{colors.warning}`): Destructive only. It is the `destructive` semantic and appears as destructive button text on a 10–20% tint of itself, plus invalid-field borders. It never carries the phosphor glow — a red reading is not something to make prettier — and it never marks a merely negative number.

### Neutral
- **Panel Black** (`{colors.panel}`): The ground everything sits on, painted once in the app shell. Also the recessed gauge face and the scrollbar track.
- **Face** (`{colors.face}`): The mid-tone of a plate's gradient and the sidebar/card surface.
- **Face Raised** (`{colors.face-raised}`): Popovers, dropdowns, and muted surfaces that sit above a plate.
- **Bezel** (`{colors.bezel}`): The default hairline border on every plate, spec row and placard; the satin ring drawn around a gauge; the secondary button fill.
- **Bezel Edge** (`{colors.bezel-edge}`): The lit top edge of a plate, the unfilled scale track on a dial, input strokes, the scrollbar thumb, and the hover border on an interactive tile.
- **Luminous** (`{colors.luminous}`): All primary text, and the major tick marks on a dial. Slightly cool white, never `#ffffff`.
- **Placard Grey** (`{colors.placard}`): Every uppercase label plate, minor tick marks, dial scale numerals, muted body copy, and a steady (neither up nor down) trend mark.

### Named Rules

**The Three Signals Rule.** Radium is a live reading, amber is a figure wanting attention, red is destructive. Those meanings are fixed app-wide and are never restyled per trip, per category, or per screen. A fourth chromatic meaning is not added; it is argued about first.

**The Achromatic Field Rule.** Nothing outside the three signals carries chroma. Category chips carry no colour at all — the word in placard caps is the category. Four category hues on this field would put four more chromatic things next to the one colour that has to be impossible to miss.

**The Chart Token Containment Rule.** `chart-1` and `chart-2` are radium and caution; `chart-3`, `chart-4`, `chart-5` are luminous, placard and bezel-edge. They exist because shadcn expects them and they are deliberately pointed back inside the panel's own range. A teal or a violet in a chart slot is a door back to a category palette; keep it shut.

**The Identity Hue Exception.** Member avatars are the one place a per-user hue is allowed, and it is bounded: initials on `oklch(0.32 0.07 H)` with `oklch(0.93 0.06 H)` text and an `oklch(0.46 0.09 H)` border, so only the hue varies and lightness and chroma stay fixed for contrast. Chroma stays at or below 0.09 — recognisably a person, never a second signal system.

## Typography

**Display Font:** Saira Variable (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Saira Variable — one family, worked by width and weight rather than by pairing
**Label/Mono Font:** JetBrains Mono Variable (with `ui-monospace, monospace`)

**Character:** Saira's variable width does the work a second family would normally do: condensed at 82% for instrument readings, slightly condensed at 92% for placard caps, normal for prose. JetBrains Mono handles anything that is a measurement, so digits sit in fixed columns and a changing number never shifts the layout around it.

### Hierarchy
- **Display** (`instrument-value`, 82% width, tabular, 1.5rem–2.25rem, line-height 1): Gauge readings, reading-strip values, the wordmark, and the invite code. On a dial the size is computed from the gauge's rendered size and the reading's own length (0.24 → 0.125 of size as the string grows), so `$1,234.56` fits the same face as `5`.
- **Headline** (600, 1.5rem, 1.875rem at `md`, tight tracking): The page `h1` in `PageHeader`, truncated to one line.
- **Title** (600, 1.25rem): Secondary screen headings such as the join preview.
- **Body** (400, 0.875rem, 1.5): Nearly all prose. Supporting lines under a reading use placard grey; explanatory copy is capped around 36–40ch inside empty and error states.
- **Label / Placard** (92% width, uppercase, 0.75rem, 0.12em tracking, placard grey): Every label plate, nav label, field label and unit line. The bottom-nav label steps down to 0.6875rem.
- **Value** (JetBrains Mono, tabular, 0.875rem): Anything measured — money, times, counts — via the `.tabular` class, which also applies to bare `output` and `time` elements.

### Named Rules

**The Placard Rule.** Uppercase letterspaced caps are a label plate bolted *under* the thing they name. They never sit above a heading as a kicker or an eyebrow. A placard names an instrument; it does not introduce a title.

**The Tabular Rule.** Anything that is a measurement is set in mono with `tabular-nums` and `zero` on. Money, durations and counts do not reflow when they change.

**The One Formatter Rule.** Money is integer cents everywhere — never a float — and every visible figure goes through `formatMoney`, every typed figure through `parseMoneyToCents`. `formatMoneyCompact` is the only sanctioned variant, for a face too small to hold the full figure.

## Layout

One centred column, `max-w-4xl` (56rem), with `px-4` on mobile and `px-6` from `md`, and `py-6` / `py-8` respectively. The trip frame is a sticky top bar (trip identity, always visible), the scrolling main column, and a sticky bottom nav within thumb reach; both bars are `panel` at 95% with a small backdrop blur and a bezel hairline. The panel ground is painted once in the app shell, so no screen repaints its own background.

The rhythm is a tight subset of the scale: `gap-3` (0.75rem) is the default between siblings, `gap-4` between grid cells, `gap-6` between major stacks, and `gap-2` inside a row. Plates take `px-5 py-4`; tiles take `p-4`; empty and error states take `px-6 py-10`.

The overview panel is the reference composition: full-width reading strips first (one column, two from `md`), then the gauge grid at `grid-cols-2` rising to `sm:grid-cols-3`, then a summary strip. Forms use `grid-cols-2` for paired fields. Interactive targets hold a minimum of 2.75rem, and the bottom-nav item is 3.5rem tall.

## Elevation & Depth

Depth here is material, not drop shadow. A plate is lit from above: a 1px inset highlight along its top edge in bezel-edge, a 176° gradient from a bezel-tinted top through face to a panel-tinted bottom, a fine turbulence texture over the fill, a bezel hairline border, and a soft contact shadow beneath. Recessed surfaces invert it — panel-black fill, bezel-edge border, and an inset shadow so the face sits *below* the panel surface. Gauge faces, empty-state icon wells and error-state icon wells are all recessed.

Phosphor is the third depth device and it is material, not decoration: a luminous marking on a night panel actually glows, so radium and amber readings carry a two-stop text glow. Red never glows.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 1px 0 0 var(--bezel-edge) inset, 0 8px 24px -12px #000000`): Every plate. The inset line is the lit bezel edge; the outer blur is contact with the panel.
- **Recessed** (`box-shadow: 0 2px 6px 0 #00000080 inset`): Anything that sits below the panel surface — gauge faces, icon wells.
- **Radium glow** (`text-shadow: 0 0 18px #7cff9e40, 0 0 5px #7cff9e30`): Live readings only.
- **Caution glow** (`text-shadow: 0 0 18px #ffb00040, 0 0 5px #ffb00030`): Amber readings only.

### Named Rules

**The Bolted Plate Rule.** A container is a plate: texture, gradient, bezel border, panel shadow, and two corner fixing heads (5px, diagonally opposed, top-right and bottom-left). A flat fill with a hairline border is the cheap version of all three materials. Plates do not nest inside plates.

**The Phosphor Rule.** Glow marks a live reading and nothing else. It is never applied as trim, to a heading, to a border, or to a destructive colour.

**The Power-On Rule.** The one authored motion moment is the self-test sweep: needles and arcs leave the 135° peg together over 900ms on `cubic-bezier(0.16, 1, 0.3, 1)`, using a `from`-only keyframe so each gauge lands on its own value. Value changes afterwards are damped over 620ms on the same curve — a real gauge settles, it does not snap. Both are fully disabled under `prefers-reduced-motion: reduce`, alongside a global reduction of all animation and scroll behaviour.

## Shapes

Machined, not soft. The base radius is 0.25rem (`{rounded.md}`) and it is the radius of a plate, a tile, and a skeleton. The scale steps by halves and doubles off that base rather than by a separate ramp. Placards and chips take 0.125rem; shadcn controls (buttons, inputs) take 0.375rem; only genuinely circular things — gauge faces, avatars, icon wells, scrollbar thumbs, fixing heads — take a full round.

Borders are always 1px and always a panel material: bezel for a plate or a divider, bezel-edge for an input, a recess or a hover state. Rules between rows are the same hairline with the last one dropped. The recurring silhouette of the whole app is the circle-inside-a-rectangle: a round recessed dial on a square bolted plate, with a label plate beneath.

## Components

### Buttons
- **Shape:** Machined corner (0.375rem), 2rem tall at default, `px-2.5`, 0.875rem medium. Presses down 1px on `:active`.
- **Primary:** Radium fill with panel-dark text; hover drops to 80% opacity. It is the only radium fill on a screen, so there is at most one per view.
- **Hover / Focus:** Focus-visible draws a radium border plus a 3px radium ring at 50%. Global `:focus-visible` is a 2px radium outline at 2px offset.
- **Outline / Secondary / Ghost:** Outline is a bezel stroke on panel, hovering to muted; secondary is a bezel fill; ghost is placard-grey text that lifts to luminous on hover with a muted wash. These carry the ordinary actions.
- **Destructive:** Warning-red text on a 10–20% tint of itself, never a solid red fill.

### Chips
- **Style:** `CategoryBadge` is placard caps inside a bezel-edge hairline at 0.125rem radius — deliberately identical for idea and expense categories, and deliberately colourless.
- **State:** No selected/unselected colour variant. Category is carried by the word.

### Cards / Containers
- **Corner Style:** 0.25rem.
- **Background:** Textured 176° gradient from bezel-tinted through face to panel-tinted.
- **Shadow Strategy:** The panel shadow (see Elevation & Depth); recessed for anything below the surface.
- **Border:** 1px bezel, plus two fixing heads via the `fixings` class.
- **Internal Padding:** `px-5 py-4` for a strip, `p-4` for a tile, `px-6 py-10` for a state panel.

### Inputs / Fields
- **Style:** Bezel-edge stroke on a near-transparent panel fill, 0.375rem radius, 2rem tall, 0.875rem from `md`. Caret is radium.
- **Focus:** Radium border plus a 3px radium ring at 50%.
- **Error / Disabled:** `aria-invalid` swaps the border to destructive with a destructive ring; the field's message renders in amber and *names the problem* rather than only going red. Disabled drops to 50% opacity with a filled input surface.
- **Label:** `Field` renders the label as a placard, with the required marker in placard grey, and wires hint and error ids into `aria-describedby`.
- **Money:** `MoneyInput` prefixes a placard `$`, uses mono tabular digits, holds raw keystrokes while focused, and stores integer cents.

### Navigation
- **Top bar:** Sticky, panel at 95% with backdrop blur under a bezel hairline. The wordmark is a placard, a bezel-edge slash separates it from the trip name, and an overflow menu holds the secondary destinations.
- **Bottom nav:** Five equal items, 3.5rem tall, icon over a 0.6875rem placard label. Inactive is placard grey at 1.75 stroke; active is radium at 2.25 stroke. Colour and stroke weight both carry the state — no pill, no underline, no indicator bar.

### Instrument (signature)
The gauge is the system. A 200-unit viewBox rendered at 124–132px: a bezel ring around a recessed panel-black face, a 270° sweep starting at 135°, 41 ticks with a major every fifth (luminous, 2.5px) and minors between (placard, 1.25px), a bezel-edge unfilled track, an optional amber caution band drawn *under* the value arc, the value arc revealed by `stroke-dashoffset` on `pathLength=1`, and a needle over a bezel-edge hub with a tone-coloured centre. The reading sits over the lower half of the face where a real gauge puts it. Trend marks come from the icon set and are only ever passed when actually derived.

**The Rendered-Size Numeral Rule.** Scale numerals are sized from the gauge's rendered `size` (`13 / size * 200`), never from the viewBox, or they land at 0.62 of nominal and become unreadable. One numeral only — the top of the range at the end of the sweep — because a single label at full scale has nothing to collide with; the rest of the range reads in the caption beneath.

**The Money Dial Rule.** Any dial holding cents must be given a `formatScale`. Without one, the raw number prints `59934` on a face that means `$599.34`.

### States
Loading, empty, loaded and error are structural, not per-screen: `QueryBoundary` and `ScreenError` make sure a failed load says so rather than falling through to an empty state. Empty and error states are plates with a recessed circular icon well — placard grey for empty, amber for error — a capped line of muted copy, and an optional action.

### shadcn/ui
Everything in `src/components/ui/` is CLI-generated and stays that way. It is themed *entirely* through the CSS custom properties on `:root` — `--primary`, `--border`, `--input`, `--ring`, `--radius` and the rest are pointed at panel materials, and the components inherit. Do not add per-component style overrides to these files; retheme by moving the variable.

## Do's and Don'ts

### Do:
- **Do** keep the field achromatic and let radium, amber and red be the only chroma, so one amber needle is unmissable.
- **Do** put every container on the `plate fixings` treatment — texture, gradient, bezel border, panel shadow, two fixing heads.
- **Do** recess anything meant to sit below the panel surface (`recessed`), including every gauge face and icon well.
- **Do** set every measurement in mono tabular, and pass every money figure through `formatMoney` on integer cents.
- **Do** give every dial an honest denominator and a `formatScale` when it holds cents; size scale numerals from the rendered size.
- **Do** put labels in placard caps *beneath* the thing they name.
- **Do** honour `prefers-reduced-motion`: the power-on sweep and needle damping both switch off.
- **Do** theme shadcn components by moving a CSS variable on `:root`, not by editing the generated component.

### Don't:
- **Don't** add a light theme or a theme toggle. Dark is the world, not a mode.
- **Don't** introduce a category colour palette, a brand accent, or a chart hue outside the panel's range — including through `--chart-3/4/5`.
- **Don't** let amber be the resting state. If it is on when nothing needs attention, it is not a signal.
- **Don't** glow a heading, a border, or a destructive colour; phosphor marks live readings only.
- **Don't** use red for a negative number. Red is destructive action only.
- **Don't** ship a kicker or eyebrow — placard caps never sit above a heading.
- **Don't** nest a plate inside a plate, or replace one with a flat fill and a hairline border.
- **Don't** use a Unicode glyph as an icon or a trend arrow; draw from the icon set.
- **Don't** decorate with a trend mark that was not actually derived from data.
- **Don't** store money as a float or format currency anywhere but `formatMoney`.
