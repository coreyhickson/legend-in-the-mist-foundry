# Legend in the Mist — Foundry Implementation Plan

---

## File Structure (target)

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
│       └── _hero-sheet.scss          all hero sheet component styles
├── module/
│   ├── data-models.mjs               Actor + Item TypeDataModels
│   ├── documents.mjs                 LitmActor + LitmItem document classes
│   ├── sheets/
│   │   ├── hero-sheet.mjs            Hero actor sheet (ApplicationV2)
│   │   ├── challenge-sheet.mjs       Challenge actor sheet (TODO)
│   │   └── fellowship-sheet.mjs      Fellowship actor sheet (TODO)
│   └── apps/
│       ├── roll-panel.mjs            Inline roll panel (Phase 3)
│       └── scene-tracker.mjs         Scene sidebar panel (Phase 6)
├── templates/
│   ├── sheets/
│   │   ├── hero-sheet.hbs
│   │   ├── challenge-sheet.hbs       (TODO)
│   │   └── fellowship-sheet.hbs      (TODO)
│   ├── partials/
│   │   └── roll-panel.hbs            Inline roll panel partial
│   └── chat/
│       └── roll-card.hbs             (Phase 3)
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
- `relationshipTags[]` — companionId, companionName, tag, singleUse
- `promiseCount` — 0–5
- `quintessences[]` — name, effect
- `fellowshipId` — ID of linked Fellowship actor (set directly on the actor, not via a system setting)

**ChallengeDataModel**
- `rating`, `role`, `might`
- `tags[]`, `statuses[]` (no polarity)
- `limits[]`, `threats[]`, `consequences[]`, `specialFeatures[]`

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
- `_onRender()` attaches `change` listeners to status name inputs to handle saves independently of form submission (avoids re-render race with tier box clicks)
- Foundry `Dialog` used for all text input prompts — `window.prompt` not supported

### Header
- Character portrait rendered as a faded background image on the left side of the header, blending into the parchment via a gradient mask; clicking opens a `FilePicker` to change the image
- Name (large italic display font) and Trope (italic, 14px) overlay the parchment area to the right of the art
- Wordmark ("Legend in the Mist / HERO SHEET") flush right
- Header is a fixed height (80px) — no vertical space lost to the portrait

### Hero Card (left panel, 250px)
- **Fellowship Relationships** — inline rows: companion name (~40%) | relationship tag (~60%), slim height
- **Promise track** — 5 clickable dots; clicking the current filled dot resets to 0
- **Quintessences** — card with left tan border accent, name (Cinzel label) + effect (textarea, auto-resizes via `field-sizing: content`)

### Themes (centre, scrollable)
- 4 theme cards displayed simultaneously in a scrollable column (no tabs)
- Each card: name input, Might selector (🌿⚔️👑), power tags, weakness tags, quest block (textarea, auto-resizes), special improvements list, AIM track (Abandon/Improve/Milestone dots)
- **Special Improvements** displayed as named ability cards with a gold left-border accent; multiple per theme; removable
- Single-click a tag to scratch it (toggle); remove button to delete
- AIM dots toggle; clicking the currently-filled dot resets to 0
- **Extra Cards** — additional cards appended below the 4 themes via an "Add Card" strip with three types:
  - **Story Theme** — title tag, 2 power tags, 1 weakness tag (short theme format)
  - **Rote** — Practitioners, Description, Success, Consequences text fields + Power tags section
  - **Custom** — free-form description field + generic tags section
  - All extra cards share the theme card visual language, include a colored type badge, and are individually removable

### Right Column (250px)
- **Statuses** — green pill elements; name is an inline editable input; 6 tier boxes (16px); active (highest marked) box solid-filled, others lightly tinted; unchecking all boxes auto-removes the status; typing `"wounded-2"` into the name field auto-parses to name="wounded" with tier 2 selected; clearing the name auto-removes the status; all statuses use a single green pill style — polarity is chosen at roll time only
- **Story Tags** — inline tag pills below statuses; scratched by clicking; shrinks to content height
- **Backpack** — slim tag rows with `///` scratch toggle; "+ Add tag" button; sits flush below story tags with no gap
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

---

## Phase 4 — Challenge Sheet

**Files to create:**
- `module/sheets/challenge-sheet.mjs`
- `templates/sheets/challenge-sheet.hbs`

### Layout
- Header: name, rating (● dots), role
- Tags section: descriptive tags (invokable from roll panel)
- Statuses: same green pill + tier-box component as Hero sheet
- Limits, Threats, Consequences, Special Features sections
- Narrator-only sections hidden from non-GM via `{{#if isGM}}`

---

## Phase 5 — Fellowship Sheet + Hero Integration

**Files to create:**
- `module/sheets/fellowship-sheet.mjs`
- `templates/sheets/fellowship-sheet.hbs`

### Fellowship sheet
- Title tag, power tags (single-use), weakness tags, quest, AIM track, special improvements

### Hero sheet integration
- `fellowshipId` stored on the Hero actor's system data
- `HeroSheet._prepareContext()` resolves the Fellowship actor and injects its tags and quest as `fellowship` in template context
- Fellowship quest displayed inline on the Hero sheet (read-only; editable only from the Fellowship sheet)
- Scratching a fellowship tag from the Hero sheet writes back to the Fellowship actor

---

## Phase 6 — Scene Tracker & Camping (deferred)

### Scene Tracker
- Per-scene sidebar panel
- Scene story tags, active challenges list, threat queue, stakes field

### Camping panel
- Modal dialog (Narrator or all players)
- REST / REFLECT / CAMP ACTION activities
- End of camping: recover fellowship power tag or create/renew relationship tag

---

## Design Decisions & Notes

- **No HP bars** — `trackableAttributes` is empty for all actor types; token bars unused
- **Tags as embedded data** — tags live inside actor system data (ArrayField of SchemaField), not as Item documents
- **Fellowship linked via actor field** — `system.fellowshipId` on the Hero actor; no system-wide setting needed
- **Polarity at roll time only** — tags and statuses do not store polarity; help vs. hinder is chosen in the roll panel
- **Burning = scratching** — burning a power tag marks it `scratched`; no separate `burned` state
- **Single-click to scratch tags** — tags are scratched by clicking (not a right-click context menu)
- **Status auto-remove** — a status is removed when all its tier boxes are unchecked, or when its name is cleared; no explicit remove button
- **Status name parsing** — typing `"wounded-2"` auto-sets name to `"wounded"` and selects tier 2
- **No polarity colours on statuses** — all statuses use a single green pill style; positive/negative is chosen at roll time
- **No might composition summary** — might type is shown per-theme only; no aggregate header display
- **Roll panel is inline, not a dialog** — opens between the roll bar and sheet body; does not obscure sheet content, allowing players to reference their tags while building the roll
- **Tag pool groups by source** — roll panel groups tags as: Theme 1, Theme 2, Theme 3, Theme 4, Fellowship, Relationship tags, visible Challenge tokens
- **Power tag polarity flipping** — in the roll panel, power tags default to positive (+1) but can be clicked again to flip to negative (−1, shown with dashed border); weakness tags are always negative
- **Detailed spend panel** — appears inline in the roll panel result area after a successful Detailed roll; shows effect costs and a manual counter; allocation tracked by player, not automated
- **Extra cards** — Story Themes, Rotes, and Custom cards are stored as an additional array on the Hero actor (`system.extraCards[]`) alongside the 4 main themes; each entry has a `type` field (`storyTheme`, `rote`, `custom`) and a flexible `fields` object
- **All IDs via `foundry.utils.randomID()`** — embedded array objects carry their own `id` field for stable references
- **Foundry v14 ApplicationV2** — all sheets and dialogs use the ApplicationV2 / DocumentSheetV2 API
- **`window.prompt` not supported** — all text prompts use Foundry's `Dialog` class instead
- **ArrayField dot-notation caveat** — updating `system.statuses.N.name` via dot-notation creates sparse arrays and fails validation; always update the full array via deepClone