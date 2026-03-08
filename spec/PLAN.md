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
│       ├── roll-dialog.mjs           Roll dialog (Phase 3)
│       └── scene-tracker.mjs         Scene sidebar panel (Phase 6)
├── templates/
│   ├── sheets/
│   │   ├── hero-sheet.hbs
│   │   ├── challenge-sheet.hbs       (TODO)
│   │   └── fellowship-sheet.hbs      (TODO)
│   ├── dialogs/
│   │   └── roll-dialog.hbs           (Phase 3)
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
│ ROLL BAR: Quick · Detailed · Reaction rolls     │
├───────────┬────────────────────────┬────────────┤
│ HERO CARD │ THEMES (scrollable)    │ RIGHT COL  │
│ 250px     │ flex-1                 │ 250px      │
│           │                        │            │
│ Fellow-   │ Theme 1                │ Statuses   │
│ ship      │ Theme 2                │ Backpack   │
│ Relation- │ Theme 3                │ Fellowship │
│ ships     │ Theme 4                │ Tags       │
│           │                        │            │
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
- `window.prompt` replaced with Foundry `Dialog` for all text input prompts

### Header
- Character portrait rendered as a faded background image on the left side of the header, blending into the parchment via a gradient mask; clicking opens a `FilePicker` to change the image
- Name (large italic display font) and Trope (italic, 14px) overlay the portrait
- Wordmark ("Legend in the Mist / HERO SHEET") flush right

### Hero Card (left panel, 250px)
- **Fellowship Relationships** — inline rows: companion name (~40%) | relationship tag (~60%), slim height
- **Promise track** — 5 clickable dots; clicking the current filled dot resets to 0
- **Quintessences** — card with left tan border accent, name (Cinzel label) + effect (textarea, auto-resizes via `field-sizing: content`)

### Themes (centre, scrollable)
- 4 theme cards, each with: name input, Might selector (🌿⚔️👑), power tags, weakness tags, quest block, special improvements list, AIM track (Abandon/Improve/Milestone dots)
- Single-click a tag to scratch it (toggle); remove button to delete
- AIM dots toggle; clicking the currently-filled dot resets to 0

### Right Column (250px, scrolls as one unit)
- **Statuses** — green pill elements; name is an inline editable input; 6 tier boxes (16px); active (highest marked) box solid-filled, others lightly tinted; unchecking all boxes auto-removes the status; typing `"wounded-2"` into the name field auto-parses to name="wounded" with tier 2 selected; clearing the name auto-removes the status
- **Backpack** — slim tag rows with `///` scratch toggle; "+ Add tag" button
- **Fellowship Tags** — reads live from the linked Fellowship actor; scratching a fellowship tag writes back to the Fellowship actor

### SCSS / visual style
- All styles scoped under `.litm-hero-sheet`; Foundry button defaults reset
- Parchment palette (`$pg`/`$pg2`/`$pg3`), warm brown borders (`$bdr`/`$bdr2`), crimson (`$crim`), gold (`$gold`), green (`$grn`), tan (`$tan`)
- Fonts: Crimson Text (body), IM Fell English (display/name), Cinzel (labels/uppercase)
- Tags: gold pill (power), crimson pill with `≫` prefix (weakness), dashed + line-through when scratched
- Status pills: green border + green text, matching power tag pill language
- Section titles: Cinzel uppercase, crimson underline

---

## Phase 3 — Roll System

**Files to create:**
- `module/apps/roll-dialog.mjs`
- `templates/dialogs/roll-dialog.hbs`
- `templates/chat/roll-card.hbs`

### RollDialog
- Extends `foundry.applications.api.ApplicationV2`
- Opened from the Hero sheet roll bar or by clicking a tag
- Groups all invokable tags by source: Theme 1–4, Backpack, Fellowship, visible Challenge tokens, Relationship tags
- Per-tag controls: checkbox to invoke, polarity choice (positive/negative) at invoke time, burn button (power tags only)
- Status invoke section: checkboxes for each active status, polarity chosen at invoke time
- Live Power total recalculated on every change
- Quick vs. Detailed vs. Reaction mode

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
Displays: Hero name, invoked tags (polarity-styled, burned marked), statuses used, dice values, Power total, final total, outcome band. Weakness tags highlighted as a reminder to mark Improve manually.

---

## Phase 4 — Challenge Sheet

**Files to create:**
- `module/sheets/challenge-sheet.mjs`
- `templates/sheets/challenge-sheet.hbs`

### Layout
- Header: name, rating (● dots), role
- Tags section: descriptive tags (invokable from roll dialog)
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
- `HeroSheet._prepareContext()` resolves the Fellowship actor and injects its tags as `fellowship` in template context
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
- **Polarity at roll time only** — tags and statuses do not store polarity; help vs. hinder is chosen in the roll dialog
- **Burning = scratching** — burning a power tag marks it `scratched`; no separate `burned` state
- **Single-click to scratch tags** — tags are scratched by clicking (not a right-click context menu)
- **Status auto-remove** — a status is removed when all its tier boxes are unchecked, or when its name is cleared; no explicit remove button
- **Status name parsing** — typing `"wounded-2"` auto-sets name to `"wounded"` and selects tier 2
- **No might composition summary** — might type is shown per-theme only; no aggregate header display
- **No polarity colours on statuses** — all statuses use a single green pill style; positive/negative is chosen at roll time
- **All IDs via `foundry.utils.randomID()`** — embedded array objects carry their own `id` field for stable references
- **Foundry v14 ApplicationV2** — all sheets and dialogs use the ApplicationV2 / DocumentSheetV2 API
- **`window.prompt` not supported** — all text prompts use Foundry's `Dialog` class instead
- **ArrayField dot-notation caveat** — updating `system.statuses.N.name` via dot-notation creates sparse arrays and fails validation; always update the full array via deepClone
