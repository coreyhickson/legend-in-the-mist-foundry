import {
  convertLimits,
  convertMightyAspects,
  convertNamedNotes,
  convertRoles,
  convertThreatsAndConsequences,
  getOrCreateWorldPack,
  parseBracketTagString,
  rewriteForgeAssetUrl,
  slugifyThemeType,
  splitTagsAndStatuses,
} from "./import-utils.mjs";
import { THEME_TYPE_GROUPS } from "./sheets/themekit-sheet.mjs";

const { DialogV2 } = foundry.applications.api;

const id = () => foundry.utils.randomID();

const SLUG_TO_MIGHT = Object.fromEntries(
  Object.entries(THEME_TYPE_GROUPS).flatMap(([might, entries]) =>
    entries.map(([slug]) => [slug, might === "any" ? "origin" : might])
  )
);

/* ─── Locating official content ──────────────────────────────────────── */
//
// Foundry's own server-side pack loader (dist/packages/world.mjs,
// World#getActivePacks) silently drops any module compendium pack whose
// declared "system" doesn't match the active world's system — before that
// data ever reaches the client. Both official modules declare
// "system": "mist-engine-fvtt", so game.packs never sees them in a world
// running this system; there is no client-side workaround. Instead, the
// user uploads a JSON export of the module's content (e.g. produced by
// `npx @foundryvtt/foundryvtt-cli package unpack` against the installed
// module, run anywhere they have file access to it — self-hosted or a
// personal local install, independent of where the actual world is hosted).
//
// Every conversion function below expects plain objects shaped exactly like
// the raw Foundry document export (name/type/img/system), whether that
// document came from a live Adventure document or a parsed JSON file — so
// only this gathering step needed to change.

const ACTOR_TYPES = ["litm-npc", "litm-journey", "litm-character"];
const ITEM_TYPES  = ["themekit", "themebook", "shortchallenge", "challenge-addon", "scene-data"];

// Scans every entry rather than just the first — a `game.actors.contents`-style
// export (e.g. from a world where the content was imported rather than a
// clean per-module CLI unpack) may mix in unrelated documents (a stray PC,
// a default sample actor, etc.), and classifying off entry[0] alone would
// misfile the whole array on a single atypical leading document.
function classifyDocs(docs) {
  const objs = docs.filter(d => d && typeof d === "object");
  if (!objs.length) return null;
  if (objs.some(d => Array.isArray(d.pages))) return "journals";
  if (objs.some(d => "grid" in d && "background" in d)) return "scenes";
  if (objs.some(d => ACTOR_TYPES.includes(d.type))) return "actors";
  if (objs.some(d => ITEM_TYPES.includes(d.type)))  return "items";
  return null;
}

const EXPORT_SCRIPT = `const data = {
  actors:   game.actors.contents.map(a => a.toObject()),
  items:    game.items.contents.map(i => i.toObject()),
  journals: game.journal.contents.map(j => j.toObject()),
  scenes:   game.scenes.contents.map(s => s.toObject()),
};
const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "world-export.json";
a.click();
URL.revokeObjectURL(url);`;

/* ─── Sample file for hand-authored content ──────────────────────────────
 *
 * One minimal, placeholder-only example of every importable document shape,
 * in the same combined {actors, items, journals, scenes} form the export
 * macro produces. Field names necessarily match what the convert* functions
 * below read (that's our own import contract, not anyone else's content) —
 * every value is generic placeholder text, not sourced from any book.
 */
const SAMPLE_IMPORT = {
  actors: [
    {
      name: "Sample Challenge",
      type: "litm-npc",
      img: null,
      system: {
        difficulty: 2,
        roles: ["Aggressor"],
        shortDescription: "A one-sentence description of this challenge.",
        floatingTagsAndStatuses: [
          { name: "example tag", isStatus: false },
          { name: "example status", isStatus: true, value: 2 },
        ],
        limits: [
          { name: "Example Limit", value: "3", consequence: "" },
          { name: "Example Immunity", value: "-", consequence: "" },
        ],
        threatsAndConsequences: [
          { name: "Example Threat", description: "What this threat represents.", list: ["An example consequence.", "Another example consequence."] },
        ],
        specialFeatures: [{ name: "Example Special Feature", description: "What it does." }],
        secrets:         [{ name: "Example Secret", description: "GM-only reference info." }],
        mightyAspects:   [{ aspect: "Example greatness aspect", level: "greatness" }],
      },
    },
    {
      name: "Sample Journey",
      type: "litm-journey",
      img: null,
      system: {
        role: "Journey - Landscape",
        shortDescription: "A one-sentence overview of this journey.",
        tags: "[example tag], [another tag]",
      },
      items: [
        {
          name: "GENERAL CONSEQUENCES",
          type: "shortchallenge",
          system: { list: ["A danger that applies to any vignette in this journey."] },
        },
        {
          name: "Sample Vignette",
          type: "shortchallenge",
          system: {
            shortDescription: "What happens in this vignette.",
            list: ["A consequence specific to this vignette."],
          },
        },
      ],
    },
  ],
  items: [
    {
      name: "Sample Theme Kit",
      type: "themekit",
      img: null,
      system: {
        themekit_type: "DUTY",
        powertags:     [{ name: "Title Tag Example" }, { name: "Power Tag Example" }],
        weaknesstags:  [{ name: "Weakness Tag Example" }],
        quest:         "An example quest for this theme kit.",
        specialImprovements: [{ name: "Example Improvement", description: "What it does." }],
      },
    },
    {
      name: "Duty",
      type: "themebook",
      img: null,
      system: {
        description:  "A one-paragraph description of this theme type.",
        powertag1:    { question: "Example power tag question one?" },
        powertag2:    { question: "Example power tag question two?" },
        weaknesstag1: { question: "Example weakness tag question one?" },
        specialImprovements: [{ name: "Example Improvement", description: "What it does." }],
      },
    },
    {
      name: "Sample Story Theme",
      type: "themebook",
      img: null,
      system: {
        description:  "A one-sentence description of this story theme.",
        powertags:    [{ name: "Power Tag Example" }, { name: "Second Power Tag Example" }],
        weaknesstags: [{ name: "Weakness Tag Example" }],
        options:      { isStoryTheme: true },
      },
    },
    {
      name: "Sample Quick Challenge",
      type: "shortchallenge",
      img: null,
      system: {
        description:      "A one-sentence description of this challenge.",
        shortDescription:  "What this danger represents.",
        list: ["An example consequence.", "Another example consequence."],
      },
    },
    {
      name: "Sample Challenge Addon",
      type: "challenge-addon",
      img: null,
      system: {
        description:    "What this addon adds to a challenge it's applied to.",
        ratingIncrease:  1,
        roles: ["Support"],
        floatingTagsAndStatuses: [{ name: "example tag", isStatus: false }],
        limits: [], threatsAndConsequences: [], specialFeatures: [], secrets: [],
      },
    },
  ],
  journals: [
    {
      name: "Sample Journal",
      pages: [
        { name: "Sample Page", type: "text", text: { format: 1, content: "<p>Example journal page content.</p>" } },
      ],
    },
  ],
  scenes: [
    {
      name: "Sample Scene",
      grid: { type: 1, size: 100 },
      background: { src: null },
      thumb: null,
      tiles: [],
    },
  ],
};

function downloadSampleImport() {
  const blob = new Blob([JSON.stringify(SAMPLE_IMPORT, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-import.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function promptForOfficialJson() {
  const proceed = await DialogV2.wait({
    window: { title: "Import Content" },
    position: { width: 560 },
    content: `
        <div style="line-height:1.5;font-size:13px;">
          <p>Import Actors, Items, Journals, and Scenes from another world by exporting them to a JSON file first. Supports the premium Legend in the Mist module format.</p>

          <ol style="margin:4px 0 8px 16px;padding:0;">
            <li>In the source world, turn the script below into a Macro: right-click an empty hotbar slot → <strong>Create Macro</strong> → Type: <strong>Script</strong> → paste it into the Command box → Save. Click it to download the exported JSON file.</li>
            <li>Come back here and select that file below.</li>
          </ol>

          <div style="position:relative; margin-bottom:8px;">
            <button type="button" class="litm-copy-script-btn" title="Copy to clipboard"
                    style="position:absolute; top:4px; right:4px; font-size:11px; padding:2px 6px; cursor:pointer;">
              <i class="fas fa-copy"></i> Copy Script
            </button>
            <pre style="background:rgba(0,0,0,0.35); border:1px solid #555; border-radius:3px; padding:8px; max-height:220px; overflow:auto; font-size:11px; line-height:1.4;"><code>${EXPORT_SCRIPT.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>
          </div>

          <details style="margin-top:8px; margin-bottom:8px;">
            <summary style="cursor:pointer; font-size:12px; opacity:0.8;">Expand for a sample format</summary>
            <div style="margin-top:6px; padding-left:2px; padding-bottom:8px;">
              <p style="font-size:12px; opacity:0.8;">Download a sample file showing the expected shape for each content type (Challenges, Journeys, Theme Kits, Theme Books, Story Themes, Challenge Addons, Journals, Scenes).</p>
              <button type="button" class="litm-download-sample-btn" style="font-size:11px; padding:2px 8px; cursor:pointer;">
                <i class="fas fa-download"></i> Download Sample File
              </button>
            </div>
          </details>
        </div>`,
    buttons: [
      { action: "import", label: "Choose File(s)…", default: true, callback: () => true },
      { action: "cancel", label: "Cancel",                          callback: () => false }
    ],
    render: (event, dialog) => {
      dialog.element.querySelector(".litm-copy-script-btn")?.addEventListener("click", async ev => {
        await game.clipboard.copyPlainText(EXPORT_SCRIPT);
        const btn = ev.currentTarget;
        const original = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      });
      dialog.element.querySelector(".litm-download-sample-btn")?.addEventListener("click", () => downloadSampleImport());
    },
  });
  if (!proceed) return null;

  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.multiple = true;
    input.onchange = async () => {
      const bucket = { actors: [], items: [], journals: [], scenes: [] };
      for (const file of Array.from(input.files)) {
        let parsed;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          ui.notifications.error(`"${file.name}" is not valid JSON — skipped.`);
          continue;
        }
        if (Array.isArray(parsed)) {
          const kind = classifyDocs(parsed);
          if (kind) bucket[kind].push(...parsed);
          else ui.notifications.warn(`Couldn't identify the document type in "${file.name}" — skipped.`);
          continue;
        }
        if (!parsed || typeof parsed !== "object") continue;

        // A combined {actors:[], items:[], ...} file
        const combinedKeys = ["actors", "items", "journals", "scenes"].filter(k => Array.isArray(parsed[k]));
        if (combinedKeys.length) {
          for (const kind of combinedKeys) bucket[kind].push(...parsed[kind]);
          continue;
        }

        // `package unpack --expandAdventures` produces one bare document per
        // file (the common case) — including the Adventure wrapper itself,
        // whose actors/items/journal/scenes are just filename strings once
        // expanded, not documents, so classifyDocs correctly skips it.
        const kind = classifyDocs([parsed]);
        if (kind) bucket[kind].push(parsed);
        else ui.notifications.warn(`Couldn't identify the document type in "${file.name}" — skipped.`);
      }
      resolve(bucket);
    };
    input.click();
  });
}

/* ─── Conversion: litm-npc -> challenge ──────────────────────────────── */

function convertChallenge(actor) {
  const s = actor.system;
  const { tags, statuses } = splitTagsAndStatuses(s.floatingTagsAndStatuses);
  const { threats, consequences } = convertThreatsAndConsequences(s.threatsAndConsequences);
  const roles = convertRoles(s.roles);

  return {
    name: actor.name,
    type: "challenge",
    img: rewriteForgeAssetUrl(actor.img),
    system: {
      rating:      s.difficulty ?? 2,
      role:        roles.join(", "),
      roles,
      description: s.shortDescription ?? "",
      tags, statuses,
      limits:          convertLimits(s.limits),
      threats, consequences,
      specialFeatures: convertNamedNotes(s.specialFeatures),
      secrets:         convertNamedNotes(s.secrets),
      mightyAspects:   convertMightyAspects(s.mightyAspects),
    }
  };
}

/* ─── Conversion: shortchallenge -> quick challenge (no Limits) ──────── */

function convertQuickChallenge(item) {
  const s = item.system;
  const threatId = id();
  const threats = [{ id: threatId, name: item.name, description: s.shortDescription ?? "", consequenceIds: [] }];
  const consequences = (s.list ?? []).map(desc => ({ id: id(), description: desc, linkedThreatId: threatId }));

  return {
    name: item.name,
    type: "challenge",
    img: rewriteForgeAssetUrl(item.img),
    system: {
      rating: 2,
      role: "", roles: [],
      description: s.description ?? "",
      tags: [], statuses: [], limits: [],
      threats, consequences,
      specialFeatures: [], secrets: [], mightyAspects: [],
    }
  };
}

/* ─── Conversion: litm-journey -> journey ─────────────────────────────── */

function convertJourney(actor) {
  const s = actor.system;
  const roleStr = (s.role ?? "").toLowerCase();
  const journeyType = roleStr.includes("occasion")    ? "occasion"
                    : roleStr.includes("undertaking")  ? "undertaking"
                    : "landscape";
  const tags = parseBracketTagString(s.tags).map(name => ({ id: id(), name, scratched: false, singleUse: false }));

  let generalDangers = [];
  const vignettes = [];
  for (const it of (actor.items ?? [])) {
    if (it.type !== "shortchallenge") continue;
    const itSys = it.system;
    if (it.name === "GENERAL CONSEQUENCES") {
      generalDangers = (itSys.list ?? []).map(desc => ({ id: id(), description: desc }));
    } else {
      vignettes.push({
        id:          id(),
        name:        it.name,
        description: itSys.shortDescription ?? "",
        consequences: (itSys.list ?? []).map(desc => ({ id: id(), description: desc })),
      });
    }
  }

  return {
    name: actor.name,
    type: "journey",
    img: rewriteForgeAssetUrl(actor.img),
    system: { journeyType, description: s.shortDescription ?? "", tags, generalDangers, vignettes }
  };
}

/* ─── Conversion: themekit / themebook / story-theme ─────────────────── */

function convertThemeKit(item, bookBySlug) {
  const s = item.system;
  const themeType = slugifyThemeType(s.themekit_type);
  const book = bookBySlug[themeType];
  const powerTagNames = (s.powertags ?? []).map(t => t.name ?? "");

  return {
    name: item.name,
    type: "themekit",
    img: rewriteForgeAssetUrl(item.img),
    system: {
      themebookId:   book ? `world.theme-books.${book.id}` : "",
      themebookName: book ? book.name : "",
      might:         SLUG_TO_MIGHT[themeType] ?? "origin",
      themeType,
      titleTag:      powerTagNames[0] ?? "",
      powerTags:     powerTagNames.slice(1),
      weaknessTags:  (s.weaknesstags ?? []).map(t => t.name ?? ""),
      quest:         s.quest ?? "",
      specialImprovements: convertNamedNotes(s.specialImprovements).filter(x => x.name || x.description),
    }
  };
}

function convertThemebook(item) {
  const s = item.system;
  const themeType = slugifyThemeType(item.name); // themebook names ARE the type, title-cased
  const powerTagQuestions = Array.from({ length: 10 }, (_, i) => ({
    key: "ABCDEFGHIJ"[i],
    question: s[`powertag${i + 1}`]?.question ?? "",
  }));
  const weaknessTagQuestions = Array.from({ length: 4 }, (_, i) => ({
    key: "ABCD"[i],
    question: s[`weaknesstag${i + 1}`]?.question ?? "",
  }));

  return {
    name: item.name,
    type: "themebook",
    img: rewriteForgeAssetUrl(item.img),
    system: {
      might:       SLUG_TO_MIGHT[themeType] ?? "origin",
      traits:      [],
      description: s.description ?? "",
      powerTagQuestions,
      weaknessTagQuestions,
      questIdeas:  [],
      specialImprovements: convertNamedNotes(s.specialImprovements).filter(x => x.name || x.description),
    }
  };
}

function convertStoryTheme(item) {
  const s = item.system;
  return {
    name: item.name,
    type: "story-theme",
    img: rewriteForgeAssetUrl(item.img),
    system: {
      description:  s.description ?? "",
      powerTags:    (s.powertags   ?? []).map(t => t.name ?? ""),
      weaknessTags: (s.weaknesstags ?? []).map(t => t.name ?? ""),
      specialImprovements: convertNamedNotes(s.specialImprovements).filter(x => x.name || x.description),
    }
  };
}

/* ─── Conversion: JournalEntry / Scene (asset URLs only, no schema change) ─
 *
 * Source `folder`/`ownership`/`playlist`/`journal` references all point at
 * documents from the exporting world, which don't exist here — dropped
 * rather than carried over as dangling ids. `flags.core.sheetClass` (the
 * official system's own journal sheet) is also dropped since it can never
 * resolve in this system; Foundry would otherwise silently fall back to the
 * default sheet anyway, so this just avoids shipping a guaranteed-dead flag.
 */

function convertJournalEntry(journal) {
  const j = foundry.utils.deepClone(journal);
  delete j._id; delete j._stats; delete j.ownership; delete j.folder; delete j.flags;
  j.pages = (j.pages ?? []).map(page => {
    const p = foundry.utils.deepClone(page);
    delete p._stats; delete p.ownership;
    p.src = rewriteForgeAssetUrl(p.src);
    if (p.image?.src) p.image = { ...p.image, src: rewriteForgeAssetUrl(p.image.src) };
    if (p.text?.content) p.text = { ...p.text, content: rewriteForgeAssetUrl(p.text.content) };
    return p;
  });
  return j;
}

function convertScene(scene) {
  const s = foundry.utils.deepClone(scene);
  delete s._id; delete s._stats; delete s.ownership; delete s.folder;
  delete s.playlist; delete s.playlistSound; delete s.journal; delete s.journalEntryPage;
  if (s.background) s.background = { ...s.background, src: rewriteForgeAssetUrl(s.background.src) };
  s.foreground = rewriteForgeAssetUrl(s.foreground);
  s.thumb      = rewriteForgeAssetUrl(s.thumb);
  s.tiles = (s.tiles ?? []).map(t => ({
    ...t,
    texture: t.texture ? { ...t.texture, src: rewriteForgeAssetUrl(t.texture.src) } : t.texture,
  }));
  return s;
}

/* ─── Conversion: challenge-addon ─────────────────────────────────────── */

function convertChallengeAddon(item) {
  const s = item.system;
  const { tags, statuses } = splitTagsAndStatuses(s.floatingTagsAndStatuses);
  const { threats, consequences } = convertThreatsAndConsequences(s.threatsAndConsequences);

  return {
    name: item.name,
    type: "challenge-addon",
    img: rewriteForgeAssetUrl(item.img),
    system: {
      description:     s.description ?? "",
      ratingIncrease:  s.ratingIncrease ?? 0,
      roles:           convertRoles(s.roles),
      tags, statuses,
      limits:          convertLimits(s.limits),
      threats, consequences,
      specialFeatures: convertNamedNotes(s.specialFeatures),
      secrets:         convertNamedNotes(s.secrets),
    }
  };
}

/* ─── Orchestration ────────────────────────────────────────────────────── */

export async function runOfficialImport() {
  const bucket = await promptForOfficialJson();
  if (!bucket) return;

  const { actors, items, journals, scenes } = bucket;
  if (!actors.length && !items.length && !journals.length && !scenes.length) {
    ui.notifications.warn("No actors, items, journals, or scenes found in the selected file(s) — nothing to import.");
    return;
  }

  const npcs           = actors.filter(a => a.type === "litm-npc");
  const journeyActors  = actors.filter(a => a.type === "litm-journey");
  const themekits      = items.filter(i => i.type === "themekit");
  const themebooksAll  = items.filter(i => i.type === "themebook");
  const realThemebooks = themebooksAll.filter(i => !i.system.options?.isStoryTheme);
  const storyThemes    = themebooksAll.filter(i => i.system.options?.isStoryTheme);
  const shortchallenges = items.filter(i => i.type === "shortchallenge");
  const addons         = items.filter(i => i.type === "challenge-addon");

  const [challengePack, journeyPack, bookPack, kitPack, storyThemePack, addonPack, journalPack, scenePack] = await Promise.all([
    (npcs.length || shortchallenges.length) ? getOrCreateWorldPack("challenges",   "Challenges",   "Actor") : null,
    journeyActors.length                    ? getOrCreateWorldPack("journeys",     "Journeys",     "Actor") : null,
    realThemebooks.length                   ? getOrCreateWorldPack("theme-books",  "Theme Books",  "Item")  : null,
    themekits.length                        ? getOrCreateWorldPack("theme-kits",   "Theme Kits",   "Item")  : null,
    storyThemes.length                      ? getOrCreateWorldPack("story-themes", "Story Themes", "Item")  : null,
    addons.length                           ? getOrCreateWorldPack("challenge-addons", "Challenge Addons", "Item") : null,
    journals.length                         ? getOrCreateWorldPack("journals",     "Journals",     "JournalEntry") : null,
    scenes.length                           ? getOrCreateWorldPack("scenes",       "Scenes",       "Scene") : null,
  ]);

  // Theme books first, since Theme Kits link to them by slug
  const createdBooks = realThemebooks.length
    ? await Item.createDocuments(realThemebooks.map(convertThemebook), { pack: bookPack.collection })
    : [];
  const bookBySlug = {};
  for (let i = 0; i < realThemebooks.length; i++) {
    const slug = slugifyThemeType(realThemebooks[i].name);
    if (createdBooks[i]) bookBySlug[slug] = { id: createdBooks[i].id, name: createdBooks[i].name };
  }

  const createdKits = themekits.length
    ? await Item.createDocuments(themekits.map(k => convertThemeKit(k, bookBySlug)), { pack: kitPack.collection })
    : [];

  const createdStoryThemes = storyThemes.length
    ? await Item.createDocuments(storyThemes.map(convertStoryTheme), { pack: storyThemePack.collection })
    : [];

  const createdAddons = addons.length
    ? await Item.createDocuments(addons.map(convertChallengeAddon), { pack: addonPack.collection })
    : [];

  const createdChallenges = npcs.length
    ? await Actor.createDocuments(npcs.map(convertChallenge), { pack: challengePack.collection })
    : [];

  const createdQuickChallenges = shortchallenges.length
    ? await Actor.createDocuments(shortchallenges.map(convertQuickChallenge), { pack: challengePack.collection })
    : [];

  const createdJourneys = journeyActors.length
    ? await Actor.createDocuments(journeyActors.map(convertJourney), { pack: journeyPack.collection })
    : [];

  const createdJournals = journals.length
    ? await JournalEntry.createDocuments(journals.map(convertJournalEntry), { pack: journalPack.collection })
    : [];

  const createdScenes = scenes.length
    ? await Scene.createDocuments(scenes.map(convertScene), { pack: scenePack.collection })
    : [];

  const total = createdBooks.length + createdKits.length + createdStoryThemes.length
              + createdAddons.length + createdChallenges.length + createdQuickChallenges.length
              + createdJourneys.length + createdJournals.length + createdScenes.length;

  ui.notifications.info(
    `Imported ${total} document(s): ` +
    `${createdChallenges.length} challenge(s), ${createdQuickChallenges.length} quick challenge(s), ` +
    `${createdJourneys.length} journey(s), ${createdBooks.length} theme book(s), ` +
    `${createdKits.length} theme kit(s), ${createdStoryThemes.length} story theme(s), ` +
    `${createdAddons.length} challenge addon(s), ${createdJournals.length} journal(s), ` +
    `${createdScenes.length} scene(s).`
  );
}
