# Legend in the Mist — Foundry Implementation Plan

---

## File Structure (current)

```
legend-in-the-mist-foundry/
├── litm.mjs                          entry point
├── system.json                       system manifest
├── lang/
│   └── en.json                       localization strings
├── styles/
│   ├── litm.css                      compiled output (do not edit)
│   └── src/
│       ├── litm.scss                 root import
│       ├── _variables.scss           palette, fonts, mixins
│       ├── _hero-sheet.scss          hero sheet component styles
│       ├── _challenge-sheet.scss     challenge sheet component styles
│       └── _fellowship-sheet.scss    fellowship sheet component styles
├── module/
│   ├── data-models.mjs               Actor + Item TypeDataModels
│   ├── documents.mjs                 LitmActor + LitmItem document classes
│   └── sheets/
│       ├── hero-sheet.mjs            Hero actor sheet (ApplicationV2)
│       ├── challenge-sheet.mjs       Challenge actor sheet
│       └── fellowship-sheet.mjs      Fellowship actor sheet
├── templates/
│   └── sheets/
│       ├── hero-sheet.hbs
│       ├── challenge-sheet.hbs
│       └── fellowship-sheet.hbs
└── spec/
    ├── SPEC.md
    ├── PLAN.md                       ← this file
    └── mock.html                     visual reference for Hero sheet
```

---

## Phase 1 — Foundation: Data Models & Document Types ✅

**Status: Complete**

### Changes made
- `system.json` — Actor types: `hero`, `challenge`, `fellowship`; Item types: `storyTag`, `themebook`; initiative `2d6`; removed `primaryTokenAttribute`
- `module/data-models.mjs` — Full rewrite with all three actor models and two item models
- `module/documents.mjs` — `LitmActor` with status/tag helper methods; `LitmItem` stub
- `litm.mjs` — Registers new data models, sheet registration, `eq` Handlebars helper
- `lang/en.json` — Labels for all types, fields, roll outcomes, and UI strings; `TYPES.Actor.*` keys at root level for Foundry window title localisation

### Data model summary

**HeroDataModel**
- `trope` — string
- `themes[]` — array of 4 theme objects (name, themebook, might, powerTags[], weaknessTags[], quest, improveCount, abandonCount, milestoneCount, improvements[], specialImprovements[])
  - `might` defaults to `"origin"`
- `statuses[]` — name, tier, markedBoxes[] (no polarity stored; help/hinder determined at roll time)
- `backpack[]` — name, scratched
- `relationshipTags[]` — id, companionId, companionName, tag, singleUse, **scratched**
- `promiseCount` — 0–5
- `quintessences[]` — name, effect
- `fellowshipId` — ID of linked Fellowship actor (set directly on the actor, not via a system setting)

**ChallengeDataModel**
- `rating`, `role`, `might`
- `tags[]`, `statuses[]` (no polarity)
- `limits[]`, `threats[]`, `consequences[]`, `specialFeatures[]`
  - `specialFeatures[]` — array of objects: `{ id, name, description }` (plain string description, no separate trigger/effect fields)

**FellowshipDataModel**
- `titleTag`, `powerTags[]`, `weaknessTags[]`, `quest`
- `improveCount`, `abandonCount`, `milestoneCount`, `specialImprovements[]`

**StoryTagDataModel** — polarity, scratched, source

**ThemebookDataModel** — mightCategory, themeType, description (HTML), specialImprovements[], samplePowerTags[], sampleWeaknessTags[]

### LitmActor helper methods
- `stackStatus(name, tier)` — adds or stacks a status per spec rules
- `reduceStatus(statusId, reduction)` — shifts marked boxes left, removes dead ones
- `scratchTag(themeId, tagId, collection)` — toggles scratched on a tag
- `burnTag(themeId, tagId)` — scratches a power tag (burned = scratched until recovered; grants +3 Power at roll time)

---

## Phase 2 — Hero Sheet ✅

**Status: Complete**

### Files created
- `module/sheets/hero-sheet.mjs`
- `templates/sheets/hero-sheet.hbs`
- `styles/src/_hero-sheet.scss` + `styles/src/_variables.scss` (compiled to `styles/litm.css`)
- `package.json` — Dart Sass build scripts (`npm run build`, `npm run watch`)

### Layout

```
┌─────────────────────────────────────────────────┐
│ HEADER: faded portrait bg · name · trope        │
├─────────────────────────────────────────────────┤
│ ROLL BAR: Quick · Detailed · Reaction buttons   │
├─────────────────────────────────────────────────┤
│ ROLL PANEL (inline, hidden by default)          │
│ Tag pool (left) · Power tally + result (right)  │
├───────────┬────────────────────────┬────────────┤
│ HERO CARD │ THEMES (scrollable)    │ RIGHT COL  │
│ 250px     │ flex-1                 │ 250px      │
│           │                        │            │
│ Fellow-   │ Theme 1                │ Statuses   │
│ ship      │ Theme 2                │ Story Tags │
│ Relation- │ Theme 3                │ Backpack   │
│ ships     │ Theme 4                │ Fellowship │
│           │ Extra Cards            │            │
│ Promise   │                        │            │
│           │                        │            │
│ Quint-    │                        │            │
│ essences  │                        │            │
└───────────┴────────────────────────┴────────────┘
```

### HeroSheet implementation notes
- Extends `HandlebarsApplicationMixin(ActorSheetV2)`, Foundry v14
- Sheet size: 1050×740px, resizable
- `_prepareContext()` pre-processes all computed data (dot arrays, box arrays, themeIndex, fellowship resolution) to avoid Handlebars helpers
- `_onRender()` attaches `change` listeners to status name inputs and all inline tag inputs; attaches `click` listeners for scratch interactions
- Foundry `Dialog` used for all text input prompts — `window.prompt` not supported

### Edit mode
- A pencil icon button in the header toggles edit mode on/off; starts in edit mode by default
- Edit mode state is stored as `_editMode` on the sheet instance (not re-rendered on toggle — class is toggled directly on the DOM)
- In view mode: `edit-only` elements (`display: none !important`) are hidden; inputs have `pointer-events: none` (non-interactive but maintain layout)
- In edit mode: `edit-only` elements are shown (`display: revert !important`); inputs are fully interactive
- This pattern prevents layout shifts between modes (inputs always take up space; only interactivity changes)
- `_onRender()` re-applies `is-editing` class and `active` state on the edit button after every data-driven re-render

### Inline tag editing
- Theme power/weakness tags: always-visible `<input>` inside the tag pill; `pointer-events: none` in view mode, `auto` in edit mode
- Title tags: same inline input pattern at `font-size: 17px`
- Tag inputs use `field-sizing: content` and `height: 1.3em` (prevents text clipping without over-expanding the pill)
- Clearing a tag input deletes the tag; clearing a title tag input does not delete (sets name to empty)
- No "edit tag group" dialog — all editing happens inline

### Scratch interactions
- All scratch actions guard with `if (event.target.tagName === "INPUT") return` — clicking directly on tag text does not scratch; clicking the tag's padding/border does
- No `stopPropagation` on inputs — pointer-events controls whether the input receives the click at all
- **Theme tags**: `data-action="scratchTag"` on the `.ch-tag` span; fires even in edit mode via padding area
- **Title tags**: `data-action="scratchThemeTitle"` on the title tag span
- **Backpack items**: click listener on `.bp-item[data-id]`; guards `ev.target.closest("button, input")`
- **Relationship tags**: click listener on `.rel-item[data-id]`; guards same; `.rel-companion` and `.rel-tag` inputs have `pointer-events: none` in view mode so clicks reach the row

### Header
- Character portrait rendered as a faded background image on the left side of the header, blending into the parchment via a gradient mask; clicking opens a `FilePicker` to change the image (edit-only)
- Name (large italic display font) and Trope (italic, 14px) overlay the parchment area to the right of the art
- Wordmark ("Legend in the Mist / HERO SHEET") flush right
- Header is a fixed height (80px) — no vertical space lost to the portrait

### Hero Card (left panel, 250px)
- **Fellowship Relationships** — inline rows: companion name (~40%) | relationship tag (~60%), slim height; click the row to scratch/unscratch; `pointer-events: none` on inputs prevents accidental scratch when typing
- **Promise track** — 5 clickable dots; clicking the current filled dot resets to 0
- **Quintessences** — card with left tan border accent, name (Cinzel label) + effect (textarea, auto-resizes via `field-sizing: content`)

### Themes (centre, scrollable)
- 4 theme cards displayed simultaneously in a scrollable column (no tabs)
- Each card: name input, Might selector (🌿⚔️👑), power tags (inline-editable), weakness tags (inline-editable), quest block (textarea, auto-resizes), special improvements list, AIM track (Abandon/Improve/Milestone dots)
- **Special Improvements** displayed as named ability cards with a gold left-border accent; `{ id, name, description }` structure; multiple per theme; removable
- Tag scratch via clicking padding/border of the pill; edit in-place via the embedded input
- AIM dots toggle; clicking the currently-filled dot resets to 0
- **Extra Cards** — additional cards appended below the 4 themes via an "Add Card" strip with three types:
  - **Story Theme** — title tag, 2 power tags, 1 weakness tag (short theme format)
  - **Rote** — Practitioners, Description, Success, Consequences text fields + Power tags section
  - **Custom** — free-form description field + generic tags section
  - All extra cards share the theme card visual language, include a colored type badge, and are individually removable

### Right Column (250px)
- **Statuses** — green pill elements; name is an inline editable input; 6 tier boxes (16px); active (highest marked) box solid-filled, others lightly tinted; unchecking all boxes auto-removes the status; typing `"wounded-2"` into the name field auto-parses to name="wounded" with tier 2 selected; clearing the name auto-removes the status; all statuses use a single green pill style — polarity is chosen at roll time only
- **Story Tags** — inline tag pills below statuses; scratched by clicking; shrinks to content height
- **Backpack** — slim tag rows with click-to-scratch; `+ Add tag` button always visible (not edit-only); adding a new item auto-focuses its input; sits flush below story tags with no gap
- **Fellowship** — quest (wrapping textarea) + tags inline; reads live from linked Fellowship actor; scratching a fellowship tag writes back to the Fellowship actor

---

## Phase 3 — Roll System

**Files to create:**
- `module/apps/roll-panel.mjs`
- `templates/partials/roll-panel.hbs`
- `templates/chat/roll-card.hbs`

### Roll Panel
- **Not a separate dialog** — renders as an inline panel injected between the roll bar and the sheet body
- Opened by clicking Quick Roll, Detailed Roll, or Reaction Roll in the roll bar; clicking the active button again closes the panel
- Active roll button is highlighted (crimson) while the panel is open
- Panel is split into two columns:
  - **Left — Tag Pool:** all non-scratched, non-burned tags grouped by source (Theme 1–4, Fellowship, visible Challenge tokens in scene, Relationship tags). Each tag is a clickable pill; selected tags are highlighted with a glow. Power tags default to positive polarity but can be flipped to negative (shown with dashed border) by clicking again. Weakness tags are always negative.
  - **Right — Power Tally + Result:** live-updating list of each selected tag's contribution (+1/−1) and any Favored/Imperiled bonuses, with a running Power total. "Roll 2d6" button submits the roll. Result appears in the same panel below the button showing individual dice, full calculation, outcome band (colour-coded), and outcome description.
- **Detailed rolls** — if the roll succeeds (7+), a Power spending sub-panel appears showing effect costs and a counter for remaining Power to allocate manually
- **Weakness tags** — auto-mark Improve on the correct theme when included in a roll
- **Close button** — dismisses the panel and deselects all tags

### RollPanel class (`roll-panel.mjs`)
- Manages open/closed state, current roll type, selected tags, and power total
- `open(type)` — builds tag pool from actor data and fellowship; renders panel
- `close()` — hides panel, resets state
- `toggleTag(tagId, source)` — adds/removes tag from selection, recalculates power
- `flipPolarity(tagId)` — toggles a power tag between positive and negative
- `calculatePower()` — sums all selected tags, statuses, and Favored/Imperiled modifiers
- `executeRoll()` — rolls 2d6 + power, resolves outcome, posts chat card, handles weakness Improve marking

### Power calculation

| Source | Effect |
|---|---|
| Invoked tag (positive) | +1 |
| Invoked tag (negative) | −1 |
| Burned power tag | +3 |
| Best positive status tier | +tier |
| Worst negative status tier | −tier |
| Favored | +3 |
| Imperiled | −3 |
| Extremely Favored | +6 |
| Extremely Imperiled | −6 |

### Roll outcomes
- Double 1s → Consequences only (override)
- Double 6s → Full Success (override)
- 10+ → Full Success
- 7–9 → Success with Consequences
- 6− → Consequences only

### Chat card
Displays: Hero name, roll type, invoked tags (polarity-styled, burned marked), dice values, Power total, final total, outcome band. Weakness tags highlighted as a reminder to mark Improve. Detailed rolls include a Power-spending reference panel in the card.

### GM roll contributions (see Phase 8)
- `RollPanel.open()` emits `rollStart` socket event with a generated `rollId`; `close()` emits `rollEnd`
- `RollPanel.activeInstance` — static reference to the currently open panel, used by the socket handler
- `_gmContributions` — in-memory array of `GMContribution` objects received from the GM's Scene Tracker
- `_onGmContributions({ rollId, contributions })` — validates rollId, stores contributions, re-renders the tally column
- Left column gains a read-only **Scene** section showing GM-contributed items when `_gmContributions.length > 0`
- GM contributions participate in the standard power tally; statuses aggregate with player statuses per best/worst rules

---

## Phase 4 — Challenge Sheet ✅

**Status: Complete**

### Files created
- `module/sheets/challenge-sheet.mjs`
- `templates/sheets/challenge-sheet.hbs`
- `styles/src/_challenge-sheet.scss`

### Layout

```
┌──────────────────────────────────────────────────┐
│ HEADER: name · rating dots · role · edit toggle  │
├────────────────────┬─────────────────────────────┤
│ LEFT COL           │ RIGHT COL                   │
│                    │                             │
│ Tags               │ Statuses                    │
│ Limits             │ Threats                     │
│ Special Features   │ Consequences                │
│                    │                             │
│ ── Input Reference ──────────────────────────── │
│ [tag] · [status-N] · {limit}                     │
└────────────────────┴─────────────────────────────┘
```

### ChallengeSheet implementation notes
- Extends `HandlebarsApplicationMixin(ActorSheetV2)`, Foundry v14
- Sheet size: 600×620px, resizable
- `scrollY` on both `.chal-left` and `.chal-right` for scroll preservation across re-renders
- Edit mode toggle (GM-only pencil button in header): `data-action="toggleEditMode"`, same DOM-direct pattern as hero sheet
- `_editMode` class property, defaults to `true`

### Edit mode
- Same pattern as hero sheet: `is-editing` class on root element, `edit-only` elements hidden in view mode
- Tag inputs have `pointer-events: none` in view mode so tags can't be edited by players; `pointer-events: auto` in edit mode
- Add/remove buttons for tags, statuses, limits, threats, consequences, special features are all `edit-only`

### Tags (challenge tags)
- Inline editable `.ch-tag-inp` inside each `.ch-tag` span
- `height: 1.3em`, `field-sizing: content`, no max-width constraint
- Click the tag's padding/border to scratch (same `event.target.tagName === "INPUT"` guard pattern)
- Tags are non-interactive in view mode via `pointer-events: none` on the input

### Statuses
- Same green pill + tier-box component as hero sheet
- Statuses do not store polarity; help/hinder chosen at roll time

### Limits
- Each limit: name, max value (displayed as `/ N`), current tier boxes
- Immunity limits (`max` is blank/null): displayed without progress boxes, just "Immune to: [name]"
- Progress limits: trigger a Special Feature when maxed
- `.lim-max-inp` uses `font-size: 16px; width: 28px`

### Consequences
- Single-line input rows; fixed `height: 20px; box-sizing: border-box` so clicking doesn't expand the row

### Special Features
- Each entry: `{ id, name, description }` — name as label, description as body text
- Both fields are inline-editable inputs/textareas

### Input Reference banner
- Collapsed banner at the bottom labelled "Input Reference:" showing inline syntax: `[tag name]` → tag pill, `[status-N]` → status pill, `{limit name}` → limit reference

---

## Phase 5 — Fellowship Sheet ✅

**Status: Complete**

### Files created
- `module/sheets/fellowship-sheet.mjs`
- `templates/sheets/fellowship-sheet.hbs`
- `styles/src/_fellowship-sheet.scss`

### Layout

```
┌────────────────────────────────────────────────┐
│ HEADER: name input · edit toggle · wordmark    │
├──────────────────────────┬─────────────────────┤
│ LEFT COL (flex-1)        │ RIGHT COL (220px)   │
│                          │                     │
│ Title Tag                │ Special             │
│ Power Tags               │ Improvements        │
│ Weakness Tags            │                     │
│ Quest                    │                     │
│ AIM Track                │                     │
└──────────────────────────┴─────────────────────┘
```

### FellowshipSheet implementation notes
- Extends `HandlebarsApplicationMixin(ActorSheetV2)`, Foundry v14
- Sheet size: 620×560px, resizable
- Same edit mode pattern as hero/challenge sheets

### Edit mode
- Pencil icon button (`.fs-edit-toggle`) in header; 26×26px, amber when active, `margin-left: 8px`
- `_editMode` defaults to `true`; toggled directly on DOM without re-render

### Inline tag editing
- Power/weakness tags: always-visible `.fs-tag-inp` inside each `.ch-tag` span
- `height: 1.3em`, `field-sizing: content`, no max-width; `pointer-events: none` in view mode
- Clearing a tag input deletes that tag
- Title tag: always-visible `.fs-title-inp`; clearing does NOT delete (title tag is a single object, not an array item)
- `.tag.weakness .fs-tag-inp { color: #e0903c; }` — weakness inputs use the orange color

### Scratch interactions
- Title tag: `data-action="scratchTitleTag"` on the tag span; guards `event.target.tagName === "INPUT"`
- Power/weakness tags: `data-action="scratchTag"` with `data-collection` and `data-tag-id`; same guard

### AIM track
- Diamond pips (`.adot`) for Abandon (3), Improve (3), Milestone (3)
- `data-action="setTrack"` with `data-track` and `data-value`; clicking the current value resets to 0

### Special Improvements
- `{ id, name, description }` structure, displayed as named cards with gold left-border accent
- Inline-editable name and description inputs
- Add/remove buttons are `edit-only`

### Hero sheet integration
- `fellowshipId` stored on the Hero actor's system data
- `HeroSheet._prepareContext()` resolves the Fellowship actor and injects its tags and quest as `fellowship` in template context
- Fellowship quest displayed inline on the Hero sheet (read-only from Hero sheet; editable from Fellowship sheet)
- Scratching a fellowship tag from the Hero sheet writes back to the Fellowship actor

---

## Challenges & Journeys — Data Model Notes

### ChallengeDataModel (additions / clarifications)

The existing fields (`rating`, `role`, `might`, `tags[]`, `statuses[]`, `limits[]`,
`threats[]`, `consequences[]`, `specialFeatures[]`) cover the core profile. The
following details refine how each field should be structured.

**`rating`** — integer 1–5, displayed as filled markers (●)

**`role`** — one or more of the named roles: `aggressor`, `pursuer`, `charge`,
`countdown`, `influence`, `mystery`, `obstacle`, `quarry`, `sapper`, `support`,
`watcher`. Stored as an array of strings so a Challenge can hold multiple roles
(e.g. `["pursuer", "watcher"]`).

**`might[]`** — array of objects: `{ aspect, level ("adventure"|"greatness"),
vulnerability }`. `vulnerability` is an optional string describing when the Might
is nullified.

**`limits[]`** — array of objects: `{ id, name, max, current, isImmunity,
isProgress, specialFeature }`.
- `isImmunity: true` when `max` is null/blank (the "–" immunity case); these
  limits are never maxed, they just signal a status type that has no effect.
- `isProgress: true` for countdown limits that trigger a Special Feature when
  maxed rather than ending the Challenge.
- `specialFeature` — string (or HTML) describing what happens when this progress
  limit is maxed.

**`threats[]`** — array of objects: `{ id, name, description }`. Each Threat
maps to one or more Consequences via a `consequenceIds[]` field so the sheet can
optionally group them.

**`consequences[]`** — array of objects: `{ id, description, linkedThreatId }`.
`linkedThreatId` is nullable — Consequences with no linked Threat are standalone
(triggered by Hero actions generating Consequences regardless of Threat).

**`specialFeatures[]`** — array of objects: `{ id, name, description }`.
`description` is a plain string combining the trigger condition and effect.

**Shorthand Challenges** — Challenges that are only briefly addressed in the
story (no Limits, written inline) are represented by setting `limits` to an empty
array. The sheet should display a clear visual indicator ("Quick — no Limits")
when `limits` is empty.

---

### Journey actor type (new)

Journeys are a distinct Challenge subtype representing multi-step progressions
(travel, social events, projects). They are overcome by completing a series of
Vignettes rather than maxing a single Limit.

**Add `journey` as a fourth actor type** in `system.json` (alongside `hero`,
`challenge`, `fellowship`).

#### JourneyDataModel

```
JourneyDataModel
├── journeyType          "landscape" | "occasion" | "undertaking"
├── steps                integer 1–6 (chosen by Narrator)
├── timeBetweenSteps     string (free text: "hours", "days", etc.)
├── currentStep          integer, 0-indexed
├── generalDangers[]     { id, description }   — Consequences valid for any step
└── vignettes[]
    ├── id
    ├── name
    ├── mustCompleteInOrder  boolean
    ├── completed           boolean
    ├── failed              boolean
    ├── blocking            boolean  — true if Heroes cannot advance until this is resolved
    ├── tags[]              { id, name, scratched }
    ├── statuses[]          { id, name, tier, markedBoxes[] }
    ├── threats[]           { id, name, description }
    └── consequences[]      { id, description, linkedThreatId }
```

Vignettes have no Limits — a single successful Quick action overcomes them. The
`blocking` flag reflects the "Blocking the Path" sidebar rule: some Vignettes
must be overcome before the Heroes advance; others can be failed and the Journey
continues anyway (with Consequences applied).

#### Journey sheet (Phase 5 or later)
- Header: journey name, type badge, step counter (e.g. "Step 2 / 4")
- Step timeline: visual row of step markers; current step highlighted; completed
  steps checked; `timeBetweenSteps` shown between markers
- General Dangers: collapsible list, always visible as a Narrator reference
- Vignette cards: one per step, showing tags, statuses, threat/consequence pairs,
  and a blocking indicator; completed/failed state toggled by the Narrator
- GM-only visibility for `blocking`, `mustCompleteInOrder`, and step controls
  (`{{#if isGM}}`)

---

### Challenge sheet notes

- **Shorthand display** — when `limits` is empty, replace the Limits section with
  a "Quick outcome" badge. Narrator can still add Limits on the fly (the spec
  notes the Narrator can define a new Limit with a 1–6 max mid-scene).
- **Immunity limits** — rendered differently from normal limits: no progress
  boxes, just a label "Immune to: [name]".
- **Progress limits** — render with a Special Feature card below the tier boxes
  describing what triggers when the Limit is maxed.
- **Linked Threats & Consequences** — optionally group Consequences under their
  parent Threat on the sheet for readability; standalone Consequences listed
  separately under "Unprompted Consequences".
- **Role badges** — display each role as a small pill badge in the header.
- **Narrator-only sections** — Limits, Special Features, Might vulnerabilities,
  and Threat/Consequence details hidden from non-GM via `{{#if isGM}}`.
- **Reveal mechanic reminder** — the spec is explicit that tags, statuses, and
  Special Features should only be revealed as they become relevant. The sheet
  should support this with a "revealed" toggle per tag, status, and Special
  Feature, visible only to the GM; unrevealed items are hidden from player-facing
  views (future player view feature).

---

## Design Decisions & Notes

- **No HP bars** — `trackableAttributes` is empty for all actor types; token bars unused
- **Tags as embedded data** — tags live inside actor system data (ArrayField of SchemaField), not as Item documents
- **Fellowship linked via actor field** — `system.fellowshipId` on the Hero actor; no system-wide setting needed
- **Polarity at roll time only** — tags and statuses do not store polarity; help vs. hinder is chosen in the roll panel
- **Burning = scratching** — burning a power tag marks it `scratched`; no separate `burned` state
- **Edit mode pattern** — all three sheets use a `_editMode` class property (default `true`) toggled by a pencil button; class is toggled directly on the DOM (no re-render); `_onRender` re-applies the state after data-driven re-renders; `edit-only` elements use `display: none !important` / `display: revert !important`
- **Inline tag editing** — all tag types across all sheets use always-visible `<input>` elements inside the tag pill; `pointer-events: none` in view mode preserves layout without interactivity; `field-sizing: content` + `height: 1.3em` prevents text clipping and auto-sizes horizontally
- **Pointer-events scratch system** — clicking a tag's padding/border area triggers the scratch action; clicking the text (the input) does not (inputs have `pointer-events: none` in view mode; scratch handlers guard `if (event.target.tagName === "INPUT") return` in edit mode); no `stopPropagation` calls needed
- **Single-click to scratch tags** — tags are scratched by clicking their border/padding (not right-click context menu)
- **Relationship tags scratched** — `relationshipTags[]` includes a `scratched` boolean field; row click toggles it; row inputs have `pointer-events: none` so clicking the row doesn't accidentally fire input events
- **Backpack new-item focus** — `_focusBackpackId` pattern: `_addBackpackItem` stores the new item's ID; `_onRender` finds and focuses the input after re-render (pointer-events temporarily set inline to allow programmatic focus)
- **Backpack add button always visible** — the `+ Add tag` button in the backpack is NOT `edit-only`; it remains visible in view mode
- **Status auto-remove** — a status is removed when all its tier boxes are unchecked, or when its name is cleared; no explicit remove button
- **Status name parsing** — typing `"wounded-2"` auto-sets name to `"wounded"` and selects tier 2
- **No polarity colours on statuses** — all statuses use a single green pill style; positive/negative is chosen at roll time
- **No might composition summary** — might type is shown per-theme only; no aggregate header display
- **Roll panel is inline, not a dialog** — opens between the roll bar and sheet body; does not obscure sheet content, allowing players to reference their tags while building the roll
- **Tag pool groups by source** — roll panel groups tags as: Theme 1, Theme 2, Theme 3, Theme 4, Fellowship, Relationship tags, visible Challenge tokens
- **Power tag polarity flipping** — in the roll panel, power tags default to positive (+1) but can be clicked again to flip to negative (−1, shown with dashed border); weakness tags are always negative
- **Detailed spend panel** — appears inline in the roll panel result area after a successful Detailed roll; shows effect costs and a counter for remaining Power to allocate manually; allocation tracked by player, not automated
- **Extra cards** — Story Themes, Rotes, and Custom cards are stored as an additional array on the Hero actor (`system.extraCards[]`) alongside the 4 main themes; each entry has a `type` field (`storyTheme`, `rote`, `custom`) and a flexible `fields` object
- **specialFeatures use description** — `specialFeatures[]` on both Hero themes and Challenges use `{ id, name, description }` (not separate `trigger`/`effect` fields); description is a free-form string
- **All IDs via `foundry.utils.randomID()`** — embedded array objects carry their own `id` field for stable references
- **Foundry v14 ApplicationV2** — all sheets and dialogs use the ApplicationV2 / DocumentSheetV2 API
- **`window.prompt` not supported** — all text prompts use Foundry's `Dialog` class instead
- **ArrayField dot-notation caveat** — updating `system.statuses.N.name` via dot-notation creates sparse arrays and fails validation; always update the full array via deepClone
- **Challenge inline reference syntax** — challenge sheet supports `[tag name]`, `[status-N]`, and `{limit name}` syntax in description fields, parsed to styled inline elements; banner labelled "Input Reference:" at sheet bottom

## Phase 6 — Scene Tracker

### Files to create
- `module/apps/scene-tracker.mjs`
- `templates/apps/scene-tracker.hbs`
- `styles/src/_scene-tracker.scss`

### Overview

The Scene Tracker is a singleton `ApplicationV2` floating window. It is the GM's live management surface for a scene: story tags, statuses, and linked challenges. It supports a **Prep Mode / Live Mode** toggle so the GM can build out a scene in advance before revealing anything to players.

Players can open the tracker and see a read-only view of whatever the GM has made visible. Hidden items are completely absent from the player-facing render; the GM sees them with a ghost/dimmed style.

---

### Data storage

All tracker data is stored in **scene flags** under the `litm` namespace:

```js
scene.flags.litm = {
  storyTags: [
    { id, name, scratched, visible }
  ],
  statuses: [
    { id, name, tier, markedBoxes[], visible }
  ],
  challengeIds: [
    { id, actorId, visible }
  ],
  mode: "prep" | "live"
}
```

- `visible` — boolean; controls player visibility per item
- `mode` — `"prep"` hides the entire tracker window from players; `"live"` shows it with per-item visibility applied
- Challenge actors are linked by `actorId` only; live data is read from the actor, never duplicated into flags
- Flag writes always replace the full array (same deepClone pattern as actor updates — no dot-notation on ArrayFields)

---

### LitmSceneTracker class (`scene-tracker.mjs`)

```
LitmSceneTracker extends HandlebarsApplicationMixin(ApplicationV2)
```

#### Singleton pattern

```js
static instance = null;

static open() {
  if (!LitmSceneTracker.instance) {
    LitmSceneTracker.instance = new LitmSceneTracker();
  }
  LitmSceneTracker.instance.render(true);
  return LitmSceneTracker.instance;
}
```

- `render(true)` brings the window to front if already open
- `close()` override sets `LitmSceneTracker.instance = null`

#### Hooks

```js
Hooks.on("canvasReady", () => LitmSceneTracker.instance?.render());
Hooks.on("updateScene", (scene, diff) => {
  if (diff.flags?.litm) LitmSceneTracker.instance?.render();
});
Hooks.on("updateActor", (actor) => {
  // Re-render if any linked challenge was updated
  const ids = SceneTrackerData.getChallengeIds();
  if (ids.includes(actor.id)) LitmSceneTracker.instance?.render();
});
```

#### Socket sync

Visibility and mode changes must propagate to connected players immediately without requiring a page action.

```js
// emit on GM side
game.socket.emit("system.litm", { type: "trackerUpdate" });

// receive on player side
game.socket.on("system.litm", ({ type }) => {
  if (type === "trackerUpdate") LitmSceneTracker.instance?.render();
});
```

Socket is registered once in `litm.mjs` during the `"ready"` hook.

#### `_prepareContext()`

```js
async _prepareContext() {
  const flags = canvas.scene?.flags?.litm ?? {};
  const isGM = game.user.isGM;
  const mode = flags.mode ?? "prep";

  const storyTags = (flags.storyTags ?? [])
    .filter(t => isGM || (mode === "live" && t.visible));

  const statuses = (flags.statuses ?? [])
    .filter(s => isGM || (mode === "live" && s.visible));

  const challenges = (flags.challengeIds ?? [])
    .filter(c => isGM || (mode === "live" && c.visible))
    .map(c => ({
      ...c,
      actor: game.actors.get(c.actorId) ?? null
    }))
    .filter(c => c.actor !== null);

  return { isGM, mode, storyTags, statuses, challenges };
}
```

- Non-GM users in prep mode receive an empty context (tracker renders as "Nothing to show yet")
- Non-GM users in live mode receive only `visible: true` items
- GM always receives all items, with `visible` state available for styling

---

### Layout

```
┌────────────────────────────────────────────┐
│ HEADER                                     │
│ "Scene Tracker" · Scene name · Mode badge  │
│ [Prep ●] / [Live ●]  toggle    [×] close  │
├─────────────────────────┬──────────────────┤
│ LEFT COL                │ RIGHT COL        │
│                         │                  │
│ Story Tags              │ Challenges       │
│ ─────────────────────   │ ──────────────── │
│ [tag pill] [eye] [×]    │ [challenge card] │
│ [tag pill] [eye] [×]    │ [challenge card] │
│ + Add story tag         │ + Link challenge  │
│                         │                  │
│ Statuses                │                  │
│ ─────────────────────   │                  │
│ [status pill] [eye] [×] │                  │
│ + Add status            │                  │
└─────────────────────────┴──────────────────┘
```

Window size: **580×520px**, resizable. `scrollY` on both columns.

---

### Header

- **Scene name** — reads from `canvas.scene.name`, non-editable (that's the scene config's job)
- **Mode toggle** — a two-state pill button: `Prep` / `Live`
  - `Prep` — amber badge; player-facing tracker shows "Nothing to show yet"
  - `Live` — green badge; per-item visibility applies
  - GM-only (`{{#if isGM}}`)
- Close button (×) in top-right, standard ApplicationV2 `[data-action="close"]`

---

### Story Tags (left column)

Each row:
```
[tag pill — inline editable name] [eye icon] [× remove]
```

- Tag pill matches the `.ch-tag` visual language from existing sheets (parchment background, rounded, scratch-line on `scratched: true`)
- Inline editable input inside the pill; same `field-sizing: content`, `height: 1.3em` pattern
- **Eye icon** (👁) — toggles `visible`; filled eye = visible to players; slashed eye = GM-only; GM-only control, `edit-only`
- **× remove** — removes the tag from the array; `edit-only`
- Scratching: clicking the tag's padding/border toggles `scratched`; same `event.target.tagName === "INPUT"` guard
- **+ Add story tag** — appends `{ id: randomID(), name: "", scratched: false, visible: false }` and focuses the new input; GM-only

Dimmed style for `visible: false` tags (GM view): `opacity: 0.45`, dashed border.

---

### Statuses (left column, below story tags)

Same green pill + tier-box component as all other sheets.

Each row:
```
[status pill (name input + tier boxes)] [eye icon] [× remove]
```

- Typing `"wounded-2"` auto-parses name and tier (same logic as hero sheet)
- Unchecking all tier boxes auto-removes the status
- Eye icon and × remove: same as story tags, GM-only
- **+ Add status** — GM-only
- Dimmed style for `visible: false` (GM view)

---

### Challenges (right column)

Each challenge is displayed as a **summary card** (not the full sheet):

```
┌─────────────────────────────────┐
│ [Role badges] · Name      [eye] │
│ Rating ●●●○○  Might icons       │
│ Tags: [pill] [pill] …           │
│ Statuses: [pill] [pill] …       │
│                           [↗ open sheet] [× unlink] │
└─────────────────────────────────┘
```

- **Role badges** — small pills for each role string in `actor.system.role[]`
- **Rating** — filled/empty dots (same as challenge sheet header)
- **Tags** — non-scratched tags only, read from `actor.system.tags`; scratched tags shown with strikethrough (dimmed, not hidden — the scratch state is informative to the GM)
- **Statuses** — same pill component; read live from actor
- **Eye icon** — toggles `visible` on the `challengeIds` entry (not on the actor itself)
- **↗ open sheet** — calls `actor.sheet.render(true)` to open the full challenge sheet
- **× unlink** — removes the `actorId` entry from `challengeIds`; does not delete the actor
- Dimmed style for `visible: false` (GM view)

**+ Link challenge** button:
- Opens a Foundry `Dialog` with a `<select>` listing all Challenge actors in the world not already linked
- On confirm, appends `{ id: randomID(), actorId, visible: false }` to `challengeIds`
- GM-only

---

### Edit mode

- Add/remove/eye controls are always visible to the GM
- Players see a fully read-only render (no controls rendered at all — not hidden via CSS, simply not present in the player-facing template branch via `{{#if isGM}}`)
- This avoids the `edit-only` / `pointer-events` pattern since there is no "view mode" for the GM — the tracker is always editable by the GM

### Roll mode (see Phase 8)

- When a `rollStart` socket event is received, `_activeRoll` is set and `.roll-mode` class is toggled on the root element — no re-render
- In roll mode, clicks on story tag pills, status pills, and challenge tag/status pills cycle through: unselected → negative → positive → unselected
- A roll mode banner is shown at the top of the body with the hero name, roll type, and a **Clear All** button
- Scratch action on story tags is suppressed while `_activeRoll` is set
- `_onRollEnd()` clears `_activeRoll`, removes `.roll-mode`, and emits a final `gmContributions` event with an empty array so the roll panel clears its Scene section

---

### SCSS notes (`_scene-tracker.scss`)

- `.st-root` — flex column, full height
- `.st-header` — flex row, space-between; mode badge uses `.badge-prep` (amber) / `.badge-live` (green)
- `.st-body` — flex row, flex-1, overflow hidden; two columns
- `.st-left`, `.st-right` — `overflow-y: auto`; left is `flex-1`, right is `260px`
- `.st-section-label` — small caps label (Cinzel, 11px, muted) above each group
- `.st-tag-row`, `.st-status-row` — flex row, align-center, gap; `.gm-hidden` modifier applies `opacity: 0.45` and dashed border
- `.st-challenge-card` — card with `border: 1px solid var(--litm-border)`, `border-radius: 6px`, `padding: 10px`; `.gm-hidden` modifier applies same opacity treatment
- `.st-eye-btn` — 20×20px icon button; uses `filter: grayscale(1) opacity(0.4)` when slashed (hidden state)
- `.st-add-btn` — full-width dashed-border button, `color: var(--litm-muted)`, GM-only

---

### Launcher

A `renderSceneControls` hook adds a **"Scene Tracker"** button to the left-side canvas controls (the layer buttons), GM-only:

```js
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  controls[0].tools.push({
    name: "litm-tracker",
    title: "Scene Tracker",
    icon: "fas fa-scroll",
    button: true,
    onClick: () => LitmSceneTracker.open()
  });
});
```

A macro can also call `LitmSceneTracker.open()` directly.

---

## Phase 7 — Party Overview

### Files to create
- `module/apps/party-overview.mjs`
- `templates/apps/party-overview.hbs`
- `styles/src/_party-overview.scss`

### Overview

The Party Overview is a singleton `ApplicationV2` window accessible to both GM and players. It provides a live read of every Hero actor's quests, weakness tags, and title tags (theme names). It is purely read-only — no editing happens here; clicking a hero's name opens their full sheet.

It is a **shared reference panel**, useful pinned alongside the scene tracker during play.

---

### Data storage

No flags or persistent data. The overview reads live from `game.actors` on every render.

---

### LitmPartyOverview class (`party-overview.mjs`)

```
LitmPartyOverview extends HandlebarsApplicationMixin(ApplicationV2)
```

Same singleton pattern as `LitmSceneTracker`.

#### Hooks

```js
Hooks.on("updateActor", () => LitmPartyOverview.instance?.render());
Hooks.on("createActor", () => LitmPartyOverview.instance?.render());
Hooks.on("deleteActor", () => LitmPartyOverview.instance?.render());
```

No socket needed — `updateActor` fires for all connected clients automatically.

#### `_prepareContext()`

```js
async _prepareContext() {
  const isGM = game.user.isGM;

  const heroes = game.actors
    .filter(a => a.type === "hero")
    .map(a => {
      const sys = a.system;

      const titleTags = sys.themes
        .map(t => ({ name: t.name, scratched: false }))
        .filter(t => t.name?.trim());

      const weaknessTags = sys.themes
        .flatMap(t => t.weaknessTags ?? [])
        .filter(t => t.name?.trim() && !t.scratched);

      const quests = sys.themes
        .map((t, i) => ({ theme: t.name || `Theme ${i + 1}`, text: t.quest }))
        .filter(q => q.text?.trim());

      const fellowship = sys.fellowshipId
        ? game.actors.get(sys.fellowshipId) ?? null
        : null;

      const fellowshipQuest = fellowship?.system?.quest ?? null;

      return {
        id: a.id,
        name: a.name,
        img: a.img,
        trope: sys.trope,
        titleTags,
        weaknessTags,
        quests,
        fellowshipQuest,
      };
    });

  return { isGM, heroes };
}
```

---

### Layout

```
┌──────────────────────────────────────────────────────┐
│ HEADER                                               │
│ "Party Overview"                                     │
├──────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ HERO CARD    │  │ HERO CARD    │  │ HERO CARD  │ │
│  │              │  │              │  │            │ │
│  │ [portrait]   │  │ [portrait]   │  │ [portrait] │ │
│  │ Name · Trope │  │ Name · Trope │  │            │ │
│  │              │  │              │  │            │ │
│  │ Title Tags   │  │ Title Tags   │  │            │ │
│  │ [pill][pill] │  │ [pill][pill] │  │            │ │
│  │              │  │              │  │            │ │
│  │ Weaknesses   │  │ Weaknesses   │  │            │ │
│  │ [pill][pill] │  │ [pill][pill] │  │            │ │
│  │              │  │              │  │            │ │
│  │ Quests       │  │ Quests       │  │            │ │
│  │ · Quest text │  │ · Quest text │  │            │ │
│  │ · Quest text │  │ · Quest text │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────┘
```

Window size: **720×560px**, resizable. Hero cards in a `flex-wrap` row; minimum card width `200px`.

---

### Header

- **Title** — "Party Overview" (Cinzel, standard wordmark style)

---

### Hero cards

Each hero renders as a vertical card:

**Portrait area**
- Small circular or square portrait (`40×40px`), `object-fit: cover`; clicking opens `actor.sheet.render(true)`
- Hero name (Cinzel, bold) + trope (italic, muted, smaller) beside portrait

**Title Tags section**
- Label: "Themes" (small-caps, muted)
- Each theme name rendered as a read-only tag pill (same `.ch-tag` visual); no scratch interaction here — this is reference only
- If a theme name is empty, it is omitted

**Weaknesses section**
- Label: "Weaknesses" (small-caps, muted, orange accent matching weakness colour)
- Non-scratched weakness tags across all four themes, rendered as orange-tinted read-only pills

**Quests section**
- Label: "Quests" (small-caps, muted)
- Each non-empty theme quest as a bullet line: `· [theme name]: [quest text]`
- Fellowship quest (if linked) listed as `· [Fellowship name]: [quest text]`, visually distinct (e.g. italic)
- Long quest text wraps within the card; no truncation

**Open sheet link**
- Clicking the hero name or portrait opens `actor.sheet.render(true)`
- No explicit button needed — cursor changes to pointer, `title` attribute shows "Open [name]'s sheet"

---

### Empty state

If no Hero actors exist in the world:

```
┌──────────────────────────────────────────┐
│  No heroes found.                        │
│  Create a Hero actor to get started.     │
└──────────────────────────────────────────┘
```

---

### SCSS notes (`_party-overview.scss`)

- `.po-root` — flex column, full height
- `.po-header` — flex row, space-between, align-center; standard header style
- `.po-cards` — `display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; overflow-y: auto; flex: 1`
- `.po-hero-card` — `min-width: 200px; flex: 1; max-width: 280px`; card border, border-radius, padding; hover state lifts slightly (`box-shadow` transition) to indicate clickability
- `.po-portrait-row` — flex row, align-center, gap; portrait is `40×40px`, `border-radius: 50%` or `6px`
- `.po-section-label` — same small-caps muted style as scene tracker
- `.po-tag-pill` — read-only variant of `.ch-tag`; no cursor change, no scratch interaction; pointer-events none
- `.po-weakness-pill` — extends `.po-tag-pill`; `color: var(--litm-weakness-orange)`, matching existing weakness tag colour
- `.po-quest-line` — `font-size: 12px; line-height: 1.5; color: var(--litm-text-muted)`; fellowship quest in italic

---

### Launcher

Same `getSceneControlButtons` hook, added alongside the Scene Tracker button:

```js
controls[0].tools.push({
  name: "litm-party",
  title: "Party Overview",
  icon: "fas fa-users",
  button: true,
  onClick: () => LitmPartyOverview.open()
});
```

Both buttons are added in the same hook handler. The Party Overview button is visible to **all users** (not GM-only), so the `if (!game.user.isGM)` guard wraps only the Scene Tracker push.

---

## Phase 8 — GM Roll Contributions

### Overview

When a player opens a roll panel, the GM can use the Scene Tracker to select scene-level story tags, scene statuses, and tags/statuses from any linked Challenge card and add them to the active roll. These contributions default to **negative polarity** (they represent environmental complications, enemy actions, or challenge pressure) but can be toggled to **positive** (e.g. a helpful story tag, a status that benefits the hero, a challenge that is advantageous in context).

This is a live, socket-synced interaction: as the GM selects or deselects items in the Scene Tracker, the player's roll panel updates in real time. The GM's selections are transient — they exist only in memory for the duration of the roll and are never written to scene flags or actor data.

---

### Roll Lifecycle

#### 1. Roll start

When a player opens the roll panel (`RollPanel.open(type)`), it generates a `rollId` and broadcasts it:

```js
const rollId = foundry.utils.randomID();
game.socket.emit("system.litm", {
  type: "rollStart",
  rollId,
  actorId: this.actor.id,
  actorName: this.actor.name,
  rollType,   // "quick" | "detailed" | "reaction"
});
```

`RollPanel` stores `this._rollId = rollId` for the lifetime of the panel.

#### 2. Roll end

When the roll panel closes (manually or after executing the roll), it broadcasts:

```js
game.socket.emit("system.litm", { type: "rollEnd", rollId: this._rollId });
```

`this._rollId` is cleared. If the panel is re-opened, a fresh `rollId` is generated.

---

### Scene Tracker — Roll Mode

#### Entering roll mode

The Scene Tracker's socket handler receives `rollStart` and stores the active roll state:

```js
this._activeRoll = {
  rollId,
  actorId,
  actorName,
  rollType,
  contributions: [],  // GMContribution[]
};
```

The tracker **does not re-render** on roll start. Instead it toggles a CSS class directly:

```js
this.element?.classList.add("roll-mode");
```

A roll mode banner appears at the top of the tracker body:

```
┌──────────────────────────────────────────┐
│ 🎲  Kira — Quick Roll   [Clear All]      │
└──────────────────────────────────────────┘
```

- Shows the hero's name and roll type
- **Clear All** button deselects all GM contributions and emits an update
- Banner is absent when no roll is active

#### Exiting roll mode

On `rollEnd` the tracker clears `this._activeRoll` and removes the `roll-mode` CSS class. Any selected tags are visually deselected without a re-render.

#### Selectable items in roll mode

In roll mode, the following items gain click targets for selection (independent of edit mode — roll selection works regardless of edit mode state):

**Story tags (left column)**
- Clicking a tag's pill area (same region as scratch) cycles its roll state: unselected → selected-negative → selected-positive → unselected
- Selected tags show a small polarity badge overlaid on the pill: `−` (red) or `+` (green)
- The edit mode scratch action is suppressed while a roll is active (clicking a tag selects/deselects it for the roll only; scratching requires edit mode with no active roll)

**Statuses (left column)**
- Clicking a status pill cycles: unselected → selected-negative → selected-positive → unselected
- When negative: contributes `−tier` (worst negative status rule; see power calculation below)
- When positive: contributes `+tier` (best positive status rule)

**Challenge cards (right column)**
- Each challenge card's tags and statuses become individually selectable in roll mode
- Same three-state cycle and polarity badge as scene tags
- The challenge card shows a subtle highlight border when any of its items are selected

#### Polarity defaults

| Item type | Default polarity |
|---|---|
| Scene story tag | Negative |
| Scene status | Negative |
| Challenge tag | Negative |
| Challenge status | Negative |

The first click always selects as negative; the second click flips to positive; the third click deselects. This matches the three-state pattern used for power tags in the roll panel, with the poles inverted.

---

### GMContribution object

```js
{
  id,          // the tag or status's own id
  name,        // display name
  type,        // "tag" | "status"
  tier,        // number (1–6, for statuses only; tags always 1)
  polarity,    // "positive" | "negative"
  source,      // "scene" | "challenge"
  actorId,     // challenge actor id (only when source === "challenge")
  actorName,   // challenge name (for display in roll panel)
}
```

---

### Socket sync — GM to players

Whenever the GM changes any contribution (add, remove, or flip polarity), the full contributions array is emitted:

```js
game.socket.emit("system.litm", {
  type: "gmContributions",
  rollId: this._activeRoll.rollId,
  contributions: this._activeRoll.contributions,
});
```

The roll panel's socket handler checks `rollId` matches and updates its local `_gmContributions` array, then re-renders the right column (tally) without rebuilding the full tag pool.

---

### Roll Panel additions

#### Left column — Scene section

A new **Scene** group appears at the bottom of the tag pool (below Relationship tags), visible only when `_gmContributions.length > 0`:

```
Scene
──────────────────────
[Abandoned Gate]  −    (scene story tag, negative)
[cornered-2]      −    (scene status, negative, tier 2)
[Hunting Pack] [thrashing blow]  −  (challenge tags)
```

- Items are read-only from the player's side; the GM controls them via the tracker
- Each item shows the polarity indicator and, for challenge items, a muted source label (e.g. `Hunting Pack`)
- Items with `polarity: "positive"` are styled green; `"negative"` styled red/dashed to match power tag conventions

#### Right column — Tally additions

GM contributions appear in the tally list with a `[Scene]` label prefix:

```
[Scene] Abandoned Gate      −1
[Scene] cornered            −2  (status, tier 2, negative)
[Scene] thrashing blow      −1
```

Power calculation rules for GM contributions:

| Source | Rule | Effect |
|---|---|---|
| GM scene/challenge tag (negative) | flat | −1 |
| GM scene/challenge tag (positive) | flat | +1 |
| GM status (negative) | **worst** negative tier among all negative statuses (scene + actor) | −tier |
| GM status (positive) | **best** positive tier among all positive statuses (scene + actor) | +tier |

Status tiers from GM contributions participate in the same best/worst aggregation as player-selected statuses — they do not stack independently. A GM-contributed `cornered-3` (negative) only improves on the player's own worst negative status if its tier is higher.

#### Chat card additions

GM-contributed tags and statuses are listed in the chat card under a **Scene** section, styled equivalently to hero tags. The card shows polarity, tier (for statuses), and source (scene or challenge name).

---

### Implementation notes

- `_activeRoll` and `_gmContributions` are instance-level in-memory state; never persisted to flags or `localStorage`
- The GM's Scene Tracker is the authoritative source of `contributions`; the player's roll panel is a read-only mirror
- If the GM closes the Scene Tracker while a roll is active, `_activeRoll` is cleared and a `gmContributions` event with an empty array is emitted so the roll panel clears the Scene section
- If multiple GMs are connected, the last-write wins (all GM clients receive their own `gmContributions` events and keep `_activeRoll` in sync)
- Roll mode selection state is stored only on the GM client that received the `rollStart` event — it is not synced between GM clients
- The `roll-mode` CSS class on `.litm-scene-tracker` drives all roll-mode visual changes; no re-render is needed to enter or exit roll mode
- Story tag scratch action: in `_scratchStoryTag`, guard with `if (this._activeRoll) return;` — scratching is disabled while a roll is active to prevent accidental scratch via the tag-selection click

### Socket handler additions (`litm.mjs`)

```js
Hooks.once("ready", () => {
  game.socket.on("system.litm", (data) => {
    if (data.type === "trackerUpdate")    LitmSceneTracker.instance?.render();
    if (data.type === "weaknessToggle")  LitmPartyOverview.instance?.render();
    if (data.type === "rollStart")       LitmSceneTracker.instance?._onRollStart(data);
    if (data.type === "rollEnd")         LitmSceneTracker.instance?._onRollEnd(data);
    if (data.type === "gmContributions") RollPanel.activeInstance?._onGmContributions(data);
  });
});
```

`RollPanel.activeInstance` is a static reference set when a roll panel opens and cleared when it closes, parallel to `LitmSceneTracker.instance`.

---

## Shared Implementation Notes

### Socket registration (`litm.mjs`)

Register the socket once in the `"ready"` hook:

```js
Hooks.once("ready", () => {
  game.socket.on("system.litm", (data) => {
    if (data.type === "trackerUpdate")    LitmSceneTracker.instance?.render();
    if (data.type === "weaknessToggle")   LitmPartyOverview.instance?.render();
    if (data.type === "rollStart")        LitmSceneTracker.instance?._onRollStart(data);
    if (data.type === "rollEnd")          LitmSceneTracker.instance?._onRollEnd(data);
    if (data.type === "gmContributions")  RollPanel.activeInstance?._onGmContributions(data);
  });
});
```

`"system.litm"` is the correct socket event name for system-registered sockets (registered in `system.json` under `"socket": true`). Add `"socket": true` to `system.json` if not already present.

### Shared helpers

Both apps can share a small utility module (`module/apps/tracker-utils.mjs`):

```js
export function getSceneFlags() {
  return canvas.scene?.flags?.litm ?? {};
}

export async function setSceneFlags(updates) {
  return canvas.scene?.setFlag("litm", updates);
}
```

### ID generation

All new items added to scene flags use `foundry.utils.randomID()` — same as embedded actor array items.

### File structure additions

```
module/
└── apps/
    ├── scene-tracker.mjs
    ├── party-overview.mjs
    └── tracker-utils.mjs
templates/
└── apps/
    ├── scene-tracker.hbs
    └── party-overview.hbs
styles/src/
├── _scene-tracker.scss
└── _party-overview.scss
```

`litm.scss` root import gains two new partials:
```scss
@use 'scene-tracker';
@use 'party-overview';
```

---

## Advanced Rules

### Trade Power (Detailed rolls only)

Before rolling a Detailed action, the player may optionally trade roll chance for spending power or vice versa. These are mutually exclusive options:

| Option | Condition | Before roll | On success, spend |
|---|---|---|---|
| **Throw caution to the wind** | Final Power ≤ 2 | Reduce Power by 1 | Original Power + 1 |
| **Hedge your risks** | Final Power ≥ 2 | Add 1 to Power | Original Power − 1 |

**Implementation notes:**
- Trade Power controls appear in the roll panel tally column when roll type is `detailed` and the player has not yet rolled
- Two buttons: "Throw Caution" (enabled when power ≤ 2) and "Hedge Risks" (enabled when power ≥ 2)
- Selecting one toggles off the other; selecting again deselects
- The adjusted power is shown in the tally; the original power is stored for spend calculation
- Trade mode is cleared if the player changes tag selection after choosing

---

### Making a Sacrifice

A Sacrifice is a roll type (alongside Quick, Detailed, Reaction) available when a Hero accepts severe Consequences to achieve something extraordinary. Unlike other roll types, **no Power is added to the roll** — the dice alone determine the outcome.

#### Sacrifice levels

| Level | Consequence | Example success |
|---|---|---|
| **Painful** | Scratch all tags in a relevant theme (one tag if lessened) | Achieve something unlikely; match a Challenge's Might one level higher/lower for a scene |
| **Scarring** | Replace a relevant theme | Achieve something extraordinary; match a Challenge's Might two levels higher/lower for a scene |
| **Grave** | Take a tier-6 status without lessening | Achieve something impossible; save someone from certain death |

#### Outcomes

| Roll | Result | Effect |
|---|---|---|
| 10+ | **Miracle** | Succeed and Sacrifice is lessened by one level |
| 7–9 | **Fate** | Succeed but pay the full Consequence of the Sacrifice |
| 6− | **In Vain** | Pay the full Consequence but gain nothing; Narrator may add further Consequences |

#### Implementation notes
- `sacrifice` is a fourth roll type value alongside `quick`, `detailed`, `reaction`
- Power total is always 0 for sacrifice rolls; tag pool is still shown for reference but tags are not selectable
- The roll panel shows a sacrifice level selector (Painful / Scarring / Grave) in place of the power tally when roll type is `sacrifice`
- Outcome labels: "Miracle" / "Fate" / "In Vain" (replacing the standard Success / Partial / Consequences labels)
- The chat card shows the chosen sacrifice level and its consequence alongside the outcome

---

### Might

Might represents the scale of power at which a Hero or Challenge operates, in a given aspect. There are three levels: **Origin**, **Adventure**, **Greatness**.

#### Challenge Might
Challenges list their Mighty aspects in their profile. In all other aspects a Challenge is at Origin level. A Might aspect has an aspect name (e.g. "magic", "size", "cunning") and optionally a vulnerability condition that nullifies it.

#### Action Might
The Narrator compares the Hero's Might level (from a relevant theme) to the Might level required by the action:

| Comparison | Result |
|---|---|
| Hero Might = Action Might | Neither Imperiled nor Favored |
| Hero Might is one level below | Imperiled |
| Hero Might is two levels below | Extremely Imperiled |
| Hero Might is one level above | Favored |
| Hero Might is two levels above | Extremely Favored |

#### Imperiled

The Hero's action requires one level of Might greater than they possess (Origin vs. Adventure, or Adventure vs. Greatness):
- **Simple action:** fails outright
- **Quick / Detailed roll:** −3 Power (in addition to all tag/status contributions)
- **Reaction:** not penalised on the roll; instead, Consequences from that source are increased by 3 status tiers or one tag

**Extremely Imperiled** (two levels below): −6 Power; Consequences increased by 6 status tiers or 3 tags.

#### Favored

The Hero's action requires one level of Might lower than they possess (Adventure vs. Origin, or Greatness vs. Adventure):
- **Simple action:** succeeds outright
- **Quick / Detailed roll:** +3 Power
- **Reaction:** not bonused on the roll; instead, Consequences from that source are decreased by 3 status tiers or one tag (potentially nullifying them)

**Extremely Favored** (two levels above): +6 Power; Consequences decreased by 6 status tiers or 3 tags.

#### Implementation notes
- Favored/Imperiled bonuses are applied as explicit tally entries in the roll panel (e.g. `Favored +3`, `Imperiled −3`), not inferred from tags
- The existing adjust +/− buttons in the roll panel tally can apply these; the label should reflect the source
- Challenge Might aspects are stored on the challenge actor (`system.might[]` as `{ aspect, level, vulnerability }`) and displayed in the Scene Tracker challenge card
- The Hero's Might level per theme is already stored as `theme.might` (`origin` / `adventure` / `greatness`); the relevant theme for a given action is chosen by the player at roll time