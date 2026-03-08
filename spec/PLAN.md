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
│   └── litm.css                      all system styles (ported from spec/mock.html)
├── module/
│   ├── data-models.mjs               Actor + Item TypeDataModels
│   ├── documents.mjs                 LitmActor + LitmItem document classes
│   ├── sheets/
│   │   ├── hero-sheet.mjs            Hero actor sheet (ApplicationV2)
│   │   ├── challenge-sheet.mjs       Challenge actor sheet
│   │   └── fellowship-sheet.mjs      Fellowship actor sheet
│   └── apps/
│       ├── roll-dialog.mjs           Roll dialog (ApplicationV2)
│       └── scene-tracker.mjs         Scene sidebar panel
├── templates/
│   ├── sheets/
│   │   ├── hero-sheet.hbs
│   │   ├── challenge-sheet.hbs
│   │   └── fellowship-sheet.hbs
│   ├── dialogs/
│   │   └── roll-dialog.hbs
│   └── chat/
│       └── roll-card.hbs
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
- `module/data-models.mjs` — Full rewrite with all three actor models and two item models (see below)
- `module/documents.mjs` — `LitmActor` with status/tag helper methods; `LitmItem` stub
- `litm.mjs` — Registers new data models; sheet registration stubbed for Phase 2
- `lang/en.json` — Labels for all types, fields, roll outcomes, and UI strings

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
- `fellowshipId` — ID of linked Fellowship actor

**ChallengeDataModel**
- `rating`, `role`, `might`
- `tags[]`, `statuses[]` (no polarity on tags or statuses; determined at roll time)
- `limits[]` — statusType, maximum (nullable), isProgress, specialFeature
- `threats[]`, `consequences[]`
- `specialFeatures[]` — condition, effect

**FellowshipDataModel**
- `titleTag`, `powerTags[]`, `weaknessTags[]`, `quest`
- `improveCount`, `abandonCount`, `milestoneCount`
- `specialImprovements[]`

**StoryTagDataModel** — polarity, scratched, source

**ThemebookDataModel** — mightCategory, themeType, description (HTML), specialImprovements[], samplePowerTags[], sampleWeaknessTags[]

### LitmActor helper methods
- `stackStatus(name, tier)` — adds or stacks a status per spec rules (no polarity)
- `reduceStatus(statusId, reduction)` — shifts marked boxes left, removes dead ones
- `scratchTag(themeId, tagId, collection)` — toggles scratched on a tag
- `burnTag(themeId, tagId)` — scratches a power tag (burned = scratched until recovered; grants +3 Power at roll time)

---

## Phase 2 — Hero Sheet

**Files to create:**
- `module/sheets/hero-sheet.mjs`
- `templates/sheets/hero-sheet.hbs`
- `styles/litm.css` (port from `spec/mock.html`)

### Layout (matches mock.html)
Three-column layout inside a fixed sheet window:

```
┌─────────────────────────────────────────────┐
│ HEADER: portrait · name · trope · wordmark  │
├─────────────────────────────────────────────┤
│ ROLL BAR: Quick · Detailed · Reaction rolls │
│           Favored/Imperiled toggles         │
├──────────┬──────────────────────┬───────────┤
│ HERO     │ THEMES (scrollable)  │ STATUSES  │
│ CARD     │                      │ STORY TAGS│
│          │ Theme 1              │ BACKPACK  │
│ Relation-│ Theme 2              │           │
│ ships    │ Theme 3              │ FELLOWSHIP│
│          │ Theme 4              │ TAGS      │
│ Promise  │                      │           │
│          │                      │           │
│ Quint-   │                      │           │
│ essences │                      │           │
└──────────┴──────────────────────┴───────────┘
```

### HeroSheet implementation notes
- Extends `foundry.applications.sheets.ActorSheetV2` (Foundry v14)
- `getData()` resolves the linked Fellowship actor and merges its tags inline
- Each theme card renders: name input, Might selector (🌿⚔️👑), power tags, weakness tags, quest, special improvements, AIM track (Abandon/Improve/Milestone dots)
- Tags are clickable spans — single-click opens roll dialog with that tag pre-selected; right-click context menu for scratch/burn/remove
- Status tier boxes rendered as a row of 6 numbered boxes; tier 5 and 6 get visual warning states
- Promise track: 5 clickable dots
- Might composition summary shown in header area (e.g. "🌿×2 ⚔️×1 👑×1")
- Fellowship tags section pulls live from the linked Fellowship actor

### CSS approach
- Port CSS variables and all component classes from `spec/mock.html` into `styles/litm.css`
- No external font imports in production (use Foundry's built-in fonts or bundle)
- All sheet classes namespaced under `.litm`

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
- Per-tag controls: checkbox to invoke, radio polarity (positive/negative), burn button (power tags only)
- Status invoke section: checkboxes for each active status, polarity pre-set from status but overridable
- Favored/Imperiled/Extreme toggles (mirrors roll bar state)
- Live Power total recalculated on every change
- Quick vs. Detailed mode toggle
- Submit button rolls `2d6`, applies Power, determines outcome, posts chat card

### Power calculation (`module/apps/roll-dialog.mjs`)
Pure function `calculatePower(selections)`:

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

### Chat card (`templates/chat/roll-card.hbs`)
Displays: Hero name + action, roll type, invoked tags (polarity-styled, burned marked), statuses used, Favored/Imperiled state, dice values, Power total, final total, outcome band (prominent). If Detailed: Power-spending panel with effect costs and remaining Power. If Consequences: narrator prompt.

Weakness tags invoked are highlighted on the card as a reminder to the player to mark Improve manually on their sheet.

---

## Phase 4 — Challenge Sheet

**Files to create:**
- `module/sheets/challenge-sheet.mjs`
- `templates/sheets/challenge-sheet.hbs`

### Layout
- Header: name, rating (● dots), role
- Tags section: descriptive tags (invokable from roll dialog)
- Statuses section: same tier-box component as Hero sheet
- Limits section: editable list (statusType, maximum, isProgress flag, special feature text)
- Narrator-only sections (hidden from non-GM via `{{#if isGM}}`):
  - Threats list
  - Consequences list
  - Special Features list (condition + effect pairs)
- Might description field

---

## Phase 5 — Fellowship Sheet + Hero Integration

**Files to create:**
- `module/sheets/fellowship-sheet.mjs`
- `templates/sheets/fellowship-sheet.hbs`

### Fellowship sheet
- Title tag (power tag; also the Fellowship's name)
- Power tags (single-use — scratched on invoke, cannot be burned)
- Weakness tags (invokable by any Hero)
- Quest field
- AIM track (Improve/Abandon/Milestone)
- Special improvements list

### Hero sheet integration
- System setting `litm.fellowshipActorId` — stores the world's Fellowship actor ID
- `HeroSheet.getData()` resolves the Fellowship actor and injects its tags into `data.fellowship`
- Fellowship tags section in the Hero sheet right column reads from this injected data
- Changes to Fellowship tags made from the Hero sheet write back to the Fellowship actor via `update()`

---

## Phase 6 — Scene Tracker & Camping (deferred)

**Files to create:**
- `module/apps/scene-tracker.mjs`
- `templates/dialogs/scene-tracker.hbs` (sidebar panel)

### Scene Tracker
- Per-scene sidebar panel (registered as a Foundry sidebar tab or floating app)
- Scene story tags (add/remove/scratch)
- Active challenges list: shows each Challenge actor token in the scene with live status display
- Threat queue: Narrator queues prepared threat text; click to send to chat
- Stakes description field

### Camping panel
- Modal dialog triggered by a button (Narrator only or all players)
- Each Hero selects 2 activities (3 if Consequences): REST / REFLECT / CAMP ACTION
- REST: Narrator marks recovered statuses and scratched tags
- REFLECT: player marks Improve on their chosen theme manually
- CAMP ACTION: opens roll dialog in camp mode (spend half Power rounded up, or roll)
- End of camping: each Hero recovers one Fellowship power tag or creates/renews a relationship tag

---

## Design Decisions & Notes

- **No HP bars** — `trackableAttributes` is empty for all actor types; token bars unused
- **Tags as embedded data, not Items** — tags live inside actor system data (ArrayField of SchemaField) rather than as separate Item documents; this keeps the sheet simple and avoids Item permission complexity
- **Fellowship tags surfaced inline** — Heroes never need to open the Fellowship sheet during play; tags are read from the linked Fellowship actor and rendered directly on the Hero sheet
- **Polarity at roll time only** — neither tags nor statuses store polarity; whether something helps or hinders is chosen in the roll dialog at the moment of invocation
- **Burning = scratching** — burning a power tag for +3 Power simply marks it `scratched`; the tag is unavailable until recovered at camping. There is no separate `burned` state.
- **All IDs generated with `foundry.utils.randomID()`** — embedded array objects carry their own `id` field for stable references across updates
- **Foundry v14 ApplicationV2** — all sheets and dialogs use the new ApplicationV2 / DocumentSheetV2 API
