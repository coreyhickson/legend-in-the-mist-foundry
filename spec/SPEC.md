# Legend in the Mist — Foundry VTT System Spec
**Foundry Compatibility Target:** v14+

---

## 1. Overview

Legend in the Mist (LitM) is a narrative-first RPG using the Mist Engine — the same engine powering City of Mist and :Otherscape. It uses **no stats**, only **tags** and **two d6**, making it structurally very different from D&D-adjacent systems. This system module must reflect that philosophy: minimal number-crunching, maximum narrative support.

The system serves two distinct user roles:
- **Players (Heroes)** — manage their character sheet, tags, themes, statuses, and rolls
- **Narrator (GM)** — manages scenes, challenges, threats, story tags, and consequences

---

## 2. Core Data Model

### 2.1 Tags
The atomic unit of the system. A tag is a short descriptor (e.g. *quick hands*, *old injury*, *charmed*).

| Property | Type | Notes |
|---|---|---|
| `name` | string | The tag text |
| `type` | enum | `power`, `weakness`, `story`, `relationship` |
| `scratched` | boolean | Temporarily unusable |
| `burned` | boolean | Used for +3 Power; permanently gone until recovered |
| `singleUse` | boolean | For Fellowship power tags and relationship tags |
| `source` | ref | Theme ID, Fellowship, backpack, scene, or challenge |

**Polarity is not stored on the tag.** It is determined at roll time by the player or Narrator. Any tag can be invoked positively or negatively depending on the narrative context — a power tag can hinder, a weakness tag can help, a story tag can go either way. The roll dialog handles polarity selection per-tag at the moment of invocation.

### 2.2 Statuses
Tags with a numeric tier (1–6). Can be positive (e.g. *glad-2*, *inspired-3*) or negative (e.g. *wounded-3*, *frightened-2*). Polarity is set when the status is created and can be changed by the Narrator.

| Property | Type | Notes |
|---|---|---|
| `name` | string | e.g. `wounded`, `glad`, `banished` |
| `polarity` | enum | `positive` or `negative` |
| `tier` | integer (1–6) | Current tier (highest marked box) |
| `markedBoxes` | integer[] | All currently marked tier boxes (for stacking) |
| `owner` | ref | Actor ID (Hero or Challenge) |

Positive statuses add their tier to Power; negative statuses subtract. In the roll dialog, the player selects which statuses to invoke; by default the best positive and worst negative are pre-selected.

**Stacking:** When the same or similar status is gained again, mark the new tier. If that box is already marked, mark the next box to the right. The rightmost marked box is the current tier.

**Reducing:** Shift all marked boxes left by the reduction amount; remove any that drop below 1.

**Limits:** Tier 5 = overcome by the status. Tier 6 = killed or transformed.

### 2.3 Themes
Each Hero has **4 themes**. Each theme contains:

| Property | Type | Notes |
|---|---|---|
| `name` | string | Title tag (also a power tag) |
| `themebook` | ref | Compendium entry used to build this theme |
| `might` | enum | `origin` (🌿), `adventure` (⚔️), `greatness` (👑) |
| `powerTags` | Tag[] | Positive tags giving Power |
| `weaknessTags` | Tag[] | Negative tags; invoke to mark Improve |
| `quest` | string | The theme's motivating goal |
| `improveCount` | integer (0–3) | At 3 → Improvement (new power tag) |
| `abandonCount` | integer (0–3) | At 3 → theme replaced |
| `milestoneCount` | integer (0–3) | At 3 → theme evolves |
| `improvements` | string[] | Unlocked improvements (usually new power tags) |

**Might categories and their theme types:**

| Might | Icon | Theme Types |
|---|---|---|
| Origin | 🌿 | Circumstance, Devotion, Past, People, Personality, Skill or Trade, Trait |
| Adventure | ⚔️ | Duty, Influence, Knowledge, Prodigious Ability, Relic, Uncanny Being |
| Greatness | 👑 | Destiny, Dominion, Mastery, Monstrosity |
| Any | — | Companion, Magic, Possessions |

A Hero's overall power level is reflected by the Might mix of their themes. The character sheet should show a summary of the Hero's Might composition (e.g. 3 Origin / 1 Adventure). Might bonuses (+3/+6 Favored, −3/−6 Imperiled) are applied per-roll in the roll dialog — the Narrator or player sets whether the action is Favored or Imperiled based on the relevant theme's Might.

**Theme evolution is free-form.** When a theme is replaced or evolved (3 Abandon or 3 Milestone), the player edits the theme directly: rename it, revise power/weakness tags, change the Might level, and update the Quest. The system resets the relevant counter and awards Promise.

### 2.4 Fellowship
A shared theme accessible to all Heroes. Structured like a Hero theme (title tag + power tags + weakness tags + Quest) with the addition of relationship tags. It can be improved, evolved, or replaced just like a Hero theme.

| Property | Type | Notes |
|---|---|---|
| `titleTag` | Tag | Power tag; also the Fellowship's name |
| `powerTags` | Tag[] | Additional power tags; single-use (scratched on invoke, cannot be burned) |
| `weaknessTags` | Tag[] | One or more weakness tags; can grow via Improvements; invokable for any Hero |
| `quest` | string | The Fellowship's shared goal |
| `improveCount` | integer (0–3) | At 3 → Fellowship Improvement |
| `abandonCount` | integer (0–3) | At 3 → Fellowship theme replaced |
| `milestoneCount` | integer (0–3) | At 3 → Fellowship theme evolves |

The Fellowship is its own Actor in Foundry but its tags and statuses are surfaced directly on each Hero's character sheet for easy access during rolls — Heroes should not need to open a separate sheet to invoke Fellowship tags.

**Relationship Tags** are stored on each Hero actor, one per other Hero in the party:

| Property | Type | Notes |
|---|---|---|
| `companionId` | ref | The other Hero actor this tag is directed at |
| `companionName` | string | Display name |
| `tag` | string | The relationship tag text (e.g. *I'd die for them*) |
| `singleUse` | boolean | Always true; recreated at camping / Fellowship Quality Time |

Relationship tags can be invoked positively or negatively at roll time. The optional rule treating them as Fellowship weakness tags (marking Fellowship Improve when invoked negatively) is a toggle in system settings.

### 2.5 Story Tags
Temporary, situational tags (positive or negative depending on context). Polarity is set at roll time, same as all other tags.

- Stored in: **Hero's backpack** (if belonging to a Hero) or a **Scene Tracking Card** (if general/environmental)
- Removed when scratched
- Expire with time (Narrator expires them at camping)

### 2.6 Challenges
Adversaries, obstacles, and dangers tracked by the Narrator. Challenges are regular Foundry Actors.

| Property | Type | Notes |
|---|---|---|
| `name` | string | |
| `rating` | integer (1–5) | General difficulty indicator (shown as ● markers) |
| `role` | string | Behavioral role in the scene (e.g. Lurker, Brute, Leader) |
| `tags` | Tag[] | Descriptive tags; can help or hinder Heroes depending on context |
| `statuses` | Status[] | Current conditions |
| `might` | string | Description of aspects where Challenge is Mighty, including Vulnerabilities |
| `limits` | Limit[] | Defeat/progress thresholds (see below) |
| `threats` | string[] | Prepared threat descriptions read during Establish |
| `consequences` | string[] | Outcomes applied when Threats materialize or Hero actions generate Consequences |
| `specialFeatures` | SpecialFeature[] | Triggered abilities with a condition and an effect |

**Limit structure:**

| Property | Type | Notes |
|---|---|---|
| `statusType` | string | The type of status that counts toward this limit (e.g. `harm`, `banish`, `convince`) |
| `maximum` | integer or null | The tier required to defeat; `null` = immunity (no maximum) |
| `isProgress` | boolean | If true, reaching max triggers a Special Feature instead of simple defeat |
| `specialFeature` | string | Description of the triggered outcome when a progress limit maxes |

The Narrator can add new Limits on the fly (choosing a maximum between 1 and 6) if Heroes find a novel approach not covered by the existing profile.

**Special Feature structure:**

| Property | Type | Notes |
|---|---|---|
| `condition` | string | Trigger text ("When this happens…") |
| `effect` | string | Outcome text ("…do this.") |

Tags and statuses on a Challenge represent its starting situation when entering the scene. They can be modified by Heroes through play, and the Narrator can add new ones as Consequences.

---

## 3. Actor Types

### 3.1 Hero (Player Character)
- Four themes with full tag/quest/progress tracking
- Backpack (story tags and gear)
- Status tracker (personal statuses)
- Relationship tags to each other Hero
- Fellowship theme tags surfaced inline
- Promise tracker
- Development tracking: Improve / Abandon / Milestone per theme

### 3.2 Challenge (Narrator-controlled)
- Standard Foundry Actor
- Tags, statuses, limits, rating, role, might, threats, consequences, special features
- No themes

### 3.3 Fellowship (Shared Actor)
- One per campaign
- Visible and usable from any Hero's sheet
- Contains Fellowship power tags, weakness tags, quest, and development tracking
- Relationship tags live on individual Hero actors

---

## 4. Roll System

### 4.1 Roll Dialog
The roll dialog is the core interactive surface of the system. It must:

1. Display all invokable tags grouped by source: each of the Hero's four themes, backpack, Fellowship, visible Challenge tokens in the scene, and relationship tags
2. Allow the player to select tags and set each one's polarity (positive/negative) at the time of invocation
3. Allow the player to select which of their active statuses to invoke, with polarity pre-set by the status but overridable
4. Show a live-updating **Power total** as selections change
5. Provide a **Burn** option per power tag (+3 Power; tag is scratched until recovered)
6. Allow the Narrator or player to set **Favored / Imperiled** state, and whether it is Extreme, before rolling
7. Specify whether the roll is **Quick** (roll only) or **Detailed** (roll + spend Power on Effects)
8. Submit → roll 2d6, calculate final total, display outcome, and post a chat card

### 4.2 Power Calculation

| Source | Effect |
|---|---|
| Each invoked tag (positive) | +1 Power |
| Each invoked tag (negative) | −1 Power |
| Burning a power tag | +3 Power (tag scratched) |
| Best invoked positive status | + tier value |
| Worst invoked negative status | − tier value |
| Favored (Might) | +3 Power |
| Imperiled (Might) | −3 Power |
| Extremely Favored | +6 Power |
| Extremely Imperiled | −6 Power |

Weakness tags mark Improve on their theme when invoked (regardless of polarity at roll time).

### 4.3 Roll Outcomes
Roll 2d6 + Power:
- **10+** (or double 6): Full Success
- **7–9**: Success with Consequences
- **6 or less** (or double 1): Consequences only

### 4.4 Spending Power (Detailed Rolls)
After rolling with a Detailed action, the player spends Power on Effects. Minimum spend of 1 even if Power is zero or negative.

| Effect | Cost |
|---|---|
| Add, scratch, or recover a tag | 2 Power |
| Give or reduce a status | 1 Power per tier |
| Discover a valuable detail | 1 Power |
| Extra feat (in addition to others) | 1 Power |
| Add single-use tag (last 1 Power only) | 1 Power |

The chat card for a Detailed roll displays an informational Power-spending panel showing the available Effects, their costs, and the player's remaining Power to allocate. Allocation is tracked by the player manually.

---

## 5. Chat Cards

Each roll produces a chat card that includes:

- **Hero name** and the action they described
- **Roll type:** Quick or Detailed
- **Tags invoked:** listed with polarity (positive shown normally, negative shown struck/dimmed), noting any that were burned
- **Statuses invoked:** listed with tier and polarity
- **Favored / Imperiled** state if applicable
- **Dice result:** the two dice values displayed individually
- **Power total** (before dice) and **final total**
- **Outcome band:** Full Success / Success with Consequences / Consequences, rendered prominently
- **If Detailed:** an interactive Power-spending panel showing available Effects and remaining Power to allocate
- **If Consequences:** a prompt/note for the Narrator to deliver Consequences

Weakness tags invoked are highlighted on the card, and the system auto-marks Improve on the relevant theme when the card is posted.

---

## 6. Reaction System
When the Narrator delivers Consequences and allows a reaction:

1. Hero describes the reaction
2. Count Power from relevant tags/statuses (same roll dialog, reaction mode)
3. Roll 2d6 + Power:
   - **10+**: Spend Power+1 on any Effect
   - **7–9**: Spend Power to lessen Consequences only
   - **6 or less**: Take Consequences as-is

The reaction costs Power upfront to initiate: 1 Power per status tier or 2 Power per tag being lessened.

---

## 7. Scene Management (Narrator Tools)

### 7.1 Scene Tracking Card
A per-scene panel (sidebar) containing:
- Scene story tags (environment and situation)
- Active challenges in the scene and their current statuses/tags
- Threat queue (Narrator's prepared threats)
- Stakes description

### 7.2 Challenges in Scene
- Add/remove challenges from the scene
- Track statuses and flag limits as reached
- Send Threats and Consequences to chat as formatted messages
- Add new Limits on the fly with a chosen maximum

### 7.3 Consequences Panel
Quick-access panel for the Narrator to:
- Apply a status (with tier) to a Hero or Challenge
- Scratch a Hero's tag
- Add a story tag to the scene or a Hero's backpack
- Invoke a Hero's weakness tag (marks Improve, sends a Consequence prompt to chat)

---

## 8. Hero Development

### 8.1 Improve / Abandon / Milestone Tracks

Each theme (including Fellowship) has three progress tracks, each with 3 boxes:

| Track | Trigger | At 3 marks |
|---|---|---|
| **Improve** | Weakness tag invoked in a roll or reaction; or Reflect at camp | Theme gains an Improvement; reset the track |
| **Abandon** | Hero ignores or betrays their Quest | Theme is replaced |
| **Milestone** | Hero achieves a significant Quest victory | Theme evolves |

Multiple Abandon or Milestone marks can be made at once when the story warrants a sudden conclusion.

### 8.2 Quest & Milestones
Each theme has a Quest — a goal, belief, or personal journey. Milestones can optionally be pre-written as three in-game sub-goals on the character sheet to help guide the Hero's journey. These are non-binding and can be revised as the story evolves.

### 8.3 Improvements
When a theme reaches 3 Improve, the player chooses one improvement and resets the track. Options:

- **New power tag** — add a tag to the theme (no hard limit on power tag count)
- **Add or remove a weakness tag** — removing reduces Improve opportunities; adding increases them
- **Special Improvement** — each theme type has 5 unique Special Improvements; each can only be chosen once
- **Reset Abandon, Milestones, or both** — stabilizes the theme against transformation
- **Mark Promise** — gains Promise without any visible change to the theme

Whenever a theme improves, the player may also **rewrite or update one existing tag** (power or weakness) to reflect how the Hero has changed.

Fellowship themes gain improvements the same way, except they cannot use improvements to mark Promise.

### 8.4 Evolving a Theme (3 Milestones)
When a theme reaches 3 Milestones, the player evolves it. This is free-form editing of the theme with the following steps:

1. Mark **Promise** once
2. Pick a new **title tag** reflecting the evolution
3. Choose a **new theme type**, or change the theme's **Might level** — it cannot remain the same
4. Revise or replace **power tags** and **weakness tags** as needed
5. Revise the **Quest** to fit the new theme
6. Trade unwanted parts of the old theme for new Improvements (optional):
   - Each power tag beyond the third → 1 Improvement
   - Each weakness tag beyond the first → 1 Improvement
   - Each Special Improvement → 1 Improvement (or keep them)

**Expanding a theme (optional):** Instead of evolving, the player may replace one of their *other* themes with a new one that expands on the evolved theme. The evolved theme's Milestone tracker resets and its Quest is rewritten.

### 8.5 Replacing a Theme (3 Abandons)
When a theme reaches 3 Abandons, the player replaces it. The old theme card is discarded. Steps:

1. Mark **Promise** once
2. Mark Promise again for each: power tag beyond the third, weakness tag beyond the first, Special Improvement in the replaced theme
3. Create a **nascent new theme** with only: title tag, one weakness tag, and a Quest (no additional power tags yet)
4. The first two times Improve is marked on this new theme, gain a new power tag instead of a regular Improvement. Once the theme has three power tags, Improve and Improvements proceed normally.

A theme can also be replaced by the Narrator when a Hero takes a tier-6 status and is transformed, or when story circumstances demand it.

### 8.6 Promise & Moments of Fulfillment
The character sheet has a **Promise track** with 5 circles. Promise is marked when:
- Evolving or replacing a theme (once per event)
- Trading excess tags/improvements during evolution or replacement (once each)
- Choosing the Promise option when improving a theme

When all 5 Promise circles are filled, the Hero has a **Moment of Fulfillment**. Reset the track (carry over any overflow). The player chooses one of the following:

| Moment | Summary |
|---|---|
| **Arrive at Journey's End** | Retire the Hero; establish a permanent safe haven for the Fellowship |
| **Be Reforged** | Replace all four themes at once; carry over improvements and Promise |
| **Gain a Quintessence** | Gain a permanent unique ability (see list below) |
| **Shake the Foundations of Magic** | Invent or discover something new about magic with the Narrator |
| **Speak Words Eternal** | Place a permanent story tag (curse, blessing, oath) on an NPC, place, or group |
| **Unearth Lost Truths** | Receive a deep secret or revelation about the world from the Narrator |

**Quintessences** (selectable under Gain a Quintessence) are permanent passive or once-per-scene/session abilities. The system should store the chosen Quintessence on the character sheet with its name and effect text. The full list includes: Beyond Luck, Canny One, Dark Horse, Diligent Drudge, Fumbling Master, Jack of Many Lives, Larger Than Life, Loyal Companion, Lucky Bastard, Magus Magnificent, Master of Craft, Master of the Little Things, Nine Lives, Old Hand, Pillar of Wisdom, The Bearer, The Common Hero, Virtuoso.

Some Quintessences modify mechanical behavior (e.g. Diligent Drudge expands the Improve track to 5 boxes; Beyond Luck disables the auto-miss on double ones). The system should account for these where possible, flagging them for manual handling where they require Narrator judgment.

---

## 9. Camping

The Narrator expires scene story tags. Each Hero chooses **2 activities** (3 with Consequences):

- **REST** — Recover some statuses and scratched power tags (Narrator's call)
- **REFLECT** — Mark Improve on one theme
- **CAMP ACTION** — Count Power, spend half (rounded up) without rolling, or roll

At end of camping, each Hero also recovers one Fellowship power tag or creates/renews a relationship tag with another Hero.

---

## 10. Item Types

| Item Type | Description |
|---|---|
| **Themebook** | Template for creating a theme (from compendium) |
| **Story Tag** | Draggable tag placeable in backpack or scene |
| **Challenge** | Packaged adversary actor with tags, statuses, limits, threats, consequences, special features |

---

## 11. UI / UX Principles

1. **No stat blocks** — the character sheet should feel like a narrative card, not a spreadsheet
2. **Tag-forward design** — tags are prominent, readable, and clickable to include in rolls
3. **Visual tag states** — clear distinction between: normal, scratched, burned, weakness, story, relationship
4. **Status tiers** — rendered as a row of 6 boxes with marks; color shifts at tier 5 and 6
5. **Theme cards** — each of the four themes displayed as a distinct card, showing its Might icon (🌿 ⚔️ 👑)
6. **Might composition summary** — a small breakdown of the Hero's theme Might mix visible on the sheet
7. **Fellowship inline** — Fellowship tags visible and invokable directly from the Hero sheet without opening a separate actor
8. **Narrator-only views** — Challenge threats, consequences, and special features not shown to players
9. **Chat card clarity** — roll outcomes are scannable at a glance; Detailed rolls surface the Power-spending interface inline
10. **Inline tag formatting** — support `[tag]`, `[status-N]`, `[/w weakness]` syntax in journal entries and chat
