import {
  ChallengeDataModel,
  FellowshipDataModel,
  HeroDataModel,
  ThemebookDataModel,
  ThemeKitDataModel,
  TropeDataModel,
} from "./module/data-models.mjs";
import { LitmActor, LitmItem } from "./module/documents.mjs";
import { HeroSheet }         from "./module/sheets/hero-sheet.mjs";
import { ChallengeSheet }    from "./module/sheets/challenge-sheet.mjs";
import { FellowshipSheet }   from "./module/sheets/fellowship-sheet.mjs";
import { ThemebookSheet }    from "./module/sheets/themebook-sheet.mjs";
import { ThemeKitSheet }     from "./module/sheets/themekit-sheet.mjs";
import { TropeSheet }        from "./module/sheets/trope-sheet.mjs";
import { LitmSceneTracker }  from "./module/apps/scene-tracker.mjs";
import { LitmPartyOverview } from "./module/apps/party-overview.mjs";
import { LitmCampingScene }  from "./module/apps/camping-scene.mjs";
import { LitmOracle }        from "./module/apps/oracle.mjs";
import { RollPanel }         from "./module/apps/roll-panel.mjs";

const PRELOAD_TEMPLATES = [
  "systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs",
  "systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs",
];

Hooks.once("init", () => {
  console.log("litm | Initializing Legend in the Mist system");

  foundry.applications.handlebars.loadTemplates(PRELOAD_TEMPLATES);

  game.settings.register("legend-in-the-mist-foundry", "oracleData", {
    name:    "Oracle Table Data",
    scope:   "world",
    config:  false,
    type:    Object,
    default: {},
  });

  game.settings.register("legend-in-the-mist-foundry", "partyHeroIds", {
    name: "Active Party Heroes",
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });

  game.settings.register("legend-in-the-mist-foundry", "permissionsInitialized", {
    name: "Permissions Initialized",
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });

  // Custom Document classes
  CONFIG.Actor.documentClass = LitmActor;
  CONFIG.Item.documentClass  = LitmItem;

  // Data models
  CONFIG.Actor.dataModels = {
    hero:        HeroDataModel,
    challenge:   ChallengeDataModel,
    fellowship:  FellowshipDataModel
  };

  CONFIG.Item.dataModels = {
    themebook: ThemebookDataModel,
    themekit:  ThemeKitDataModel,
    trope:     TropeDataModel,
  };


  CONFIG.Actor.trackableAttributes = {
    hero:       { bar: [], value: [] },
    challenge:  { bar: [], value: [] },
    fellowship: { bar: [], value: [] }
  };

  // Sheet registrations
  foundry.documents.collections.Actors.registerSheet("litm", HeroSheet, {
    types: ["hero"],
    makeDefault: true,
    label: "LITM.Sheet.HeroSheet"
  });

  foundry.documents.collections.Actors.registerSheet("litm", ChallengeSheet, {
    types: ["challenge"],
    makeDefault: true,
    label: "LITM.Sheet.ChallengeSheet"
  });

  foundry.documents.collections.Actors.registerSheet("litm", FellowshipSheet, {
    types: ["fellowship"],
    makeDefault: true,
    label: "LITM.Sheet.FellowshipSheet"
  });

  foundry.documents.collections.Items.registerSheet("litm", ThemebookSheet, {
    types: ["themebook"],
    makeDefault: true,
    label: "LITM.Item.Types.themebook"
  });

  foundry.documents.collections.Items.registerSheet("litm", ThemeKitSheet, {
    types: ["themekit"],
    makeDefault: true,
    label: "LITM.Item.Types.themekit"
  });

  foundry.documents.collections.Items.registerSheet("litm", TropeSheet, {
    types: ["trope"],
    makeDefault: true,
    label: "LITM.Item.Types.trope"
  });

  // Register eq helper for Handlebars (used in templates)
  Handlebars.registerHelper("eq", (a, b) => a === b);
});

// Tour subclass that opens a hero sheet before steps that target sheet elements
class LitmTour extends foundry.nue.Tour {
  static HERO_SHEET_STEPS = new Set(["hero-sheet", "hero-themes", "hero-edit", "hero-roll"]);

  async _preStep() {
    await super._preStep();
    if (!LitmTour.HERO_SHEET_STEPS.has(this.currentStep?.id)) return;
    const hero = game.actors.find(a => a.type === "hero" && (game.user.isGM || a.isOwner));
    if (!hero) return;
    if (!hero.sheet.rendered) {
      hero.sheet.render(true);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

Hooks.once("ready", async () => {
  console.log("litm | Legend in the Mist system ready");

  // Expose for macro access: LitmSceneTracker.open()
  game.litm = { sceneTracker: LitmSceneTracker, partyOverview: LitmPartyOverview, campingScene: LitmCampingScene, oracle: LitmOracle };

  // Register and auto-start the getting started tour
  try {
    await game.tours.register(
      "legend-in-the-mist-foundry",
      "getting-started",
      await LitmTour.fromJSON("systems/legend-in-the-mist-foundry/tours/getting-started.json")
    );
    const tour = game.tours.get("legend-in-the-mist-foundry.getting-started");
    if (tour?.status === "unstarted") tour.start();
  } catch(err) {
    console.warn("litm | Could not register getting-started tour:", err);
  }

  // One-time setup: grant Players permission to create actors (heroes)
  if (game.user.isGM && !game.settings.get("legend-in-the-mist-foundry", "permissionsInitialized")) {
    const perms = foundry.utils.deepClone(game.settings.get("core", "permissions"));
    if (perms.ACTOR_CREATE && !perms.ACTOR_CREATE.includes(CONST.USER_ROLES.PLAYER)) {
      perms.ACTOR_CREATE = [...perms.ACTOR_CREATE, CONST.USER_ROLES.PLAYER].sort();
    }
    await game.settings.set("core", "permissions", perms);
    await game.settings.set("legend-in-the-mist-foundry", "permissionsInitialized", true);
  }

  game.socket.on("system.legend-in-the-mist-foundry", (data) => {
    if (data.type === "campingOpen") {
      LitmCampingScene.open({ fromSocket: true });
      return;
    }
    if (data.type === "campingSave" && game.user.isGM) {
      canvas.scene?.setFlag("legend-in-the-mist-foundry", "camping", data.camping);
      return;
    }
    if (data.type === "campingEnd") {
      LitmCampingScene.instance?.close();
      return;
    }
    if (data.type === "rollStart") {
      if (game.user.isGM) {
        if (!LitmSceneTracker.instance) {
          LitmSceneTracker.instance = new LitmSceneTracker();
          LitmSceneTracker.instance._onRollStart({ ...data, skipRender: true });
          LitmSceneTracker.instance.render(true);
        } else {
          LitmSceneTracker.instance._onRollStart(data);
        }
      }
    } else if (data.type === "rollEnd") {
      LitmSceneTracker.instance?._onRollEnd(data);
    } else if (data.type === "gmContributions") {
      RollPanel.activeInstance?._onGmContributions(data);
    }
  });
});

// Re-render scene tracker when scene flags change
Hooks.on("updateScene", (scene, diff) => {
  if (diff.flags?.["legend-in-the-mist-foundry"]) {
    LitmSceneTracker.instance?.render();
    LitmCampingScene.instance?.render();
  }
});


// Re-render scene tracker when switching to a new scene
Hooks.on("canvasReady", () => {
  LitmSceneTracker.instance?.render();
  LitmCampingScene.instance?.render();
});

// Re-render scene tracker when a linked challenge actor is updated
Hooks.on("updateActor", (actor) => {
  const flags  = canvas.scene?.flags?.["legend-in-the-mist-foundry"] ?? {};
  const linked = (flags.challengeIds ?? []).map(c => c.actorId);
  if (linked.includes(actor.id)) LitmSceneTracker.instance?.render();
});

// Re-render party overview and camping scene on any actor change
Hooks.on("updateActor", () => {
  LitmPartyOverview.instance?.render();
  LitmCampingScene.instance?.render();
});

Hooks.on("createActor", (actor) => {
  LitmPartyOverview.instance?.render();
  if (actor.type !== "hero" || !game.user.isGM) return;
  const ids = game.settings.get("legend-in-the-mist-foundry", "partyHeroIds");
  if (ids !== null && !ids.includes(actor.id)) {
    game.settings.set("legend-in-the-mist-foundry", "partyHeroIds", [...ids, actor.id]);
  }
});

Hooks.on("deleteActor", (actor) => {
  LitmPartyOverview.instance?.render();
  if (actor.type !== "hero" || !game.user.isGM) return;
  const ids = game.settings.get("legend-in-the-mist-foundry", "partyHeroIds");
  if (ids !== null && ids.includes(actor.id)) {
    game.settings.set("legend-in-the-mist-foundry", "partyHeroIds", ids.filter(id => id !== actor.id));
  }
});

// Canvas control buttons — Scene Tracker (GM only) + Party Overview (all users)
// In Foundry v14, controls is a plain object keyed by group name.
// In pre-v14, it was an array.
Hooks.on("getSceneControlButtons", (controls) => {
  const sceneTrackerTool = {
    name:     "scene-tracker",
    title:    "Scene Tracker",
    icon:     "fas fa-scroll",
    button:   true,
    onChange: () => LitmSceneTracker.open()
  };

  const partyOverviewTool = {
    name:     "party-overview",
    title:    "Party Overview",
    icon:     "fas fa-users",
    button:   true,
    onChange: () => LitmPartyOverview.open()
  };

  const campingTool = {
    name:     "camping",
    title:    "Camping Scene",
    icon:     "fas fa-campfire",
    button:   true,
    onChange: () => LitmCampingScene.open()
  };

  const oracleTool = {
    name:     "oracle",
    title:    "Oracle",
    icon:     "fas fa-crystal-ball",
    button:   true,
    onChange: () => LitmOracle.open()
  };

  const tourTool = {
    name:     "tour",
    title:    "Getting Started Tour",
    icon:     "fas fa-question-circle",
    button:   true,
    onChange: async () => {
      const t = game.tours.get("legend-in-the-mist-foundry.getting-started");
      if (t) { await t.reset(); t.start(); }
    }
  };

  if (Array.isArray(controls)) {
    // Pre-v14 format
    const group = controls.find(c => c.name === "token");
    if (group) {
      group.tools.push(sceneTrackerTool);
      group.tools.push(partyOverviewTool);
      group.tools.push(campingTool);
      group.tools.push(oracleTool);
      group.tools.push(tourTool);
    }
  } else if (controls && typeof controls === "object") {
    // Foundry v14 format: object keyed by group name, tools also an object
    if (!controls.litm) {
      controls.litm = {
        name:    "litm",
        title:   "Legend in the Mist",
        icon:    "fas fa-scroll",
        layer:   "token",
        visible: true,
        tools:   {}
      };
    }
    controls.litm.tools["scene-tracker"] = sceneTrackerTool;
    controls.litm.tools["party-overview"] = partyOverviewTool;
    controls.litm.tools["camping"]         = campingTool;
    controls.litm.tools["oracle"]          = oracleTool;
    controls.litm.tools["tour"]            = tourTool;
  }
});

Hooks.on("updateActor", (actor) => {
  if (actor.type !== "fellowship") return;
  for (const hero of game.actors.filter(a => a.type === "hero" && a.system.fellowshipId === actor.id)) {
    if (hero.sheet?.rendered) hero.sheet.render();
  }
});

// ── Compendium helpers ────────────────────────────────────────────────
async function getOrCreateWorldPack(name, label, type) {
  const existing = game.packs.get(`world.${name}`);
  if (existing) return existing;
  return CompendiumCollection.createCompendium({
    name,
    label,
    type,
    system: "legend-in-the-mist-foundry",
  });
}

// ── Import buttons in Compendium sidebar ──────────────────────────────
Hooks.on("renderCompendiumDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const header = html.querySelector ? html.querySelector(".directory-header") : html.find(".directory-header")[0];
  if (!header) return;

  const actions = header.querySelector ? header.querySelector(".header-actions") : null;
  const target  = actions ?? header;

  const mkBtn = (cls, title, label, handler) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.title = title;
    btn.innerHTML = `<i class="fas fa-file-import"></i> ${label}`;
    btn.style.cssText = "font-size:12px;padding:3px 8px;margin-left:4px;";
    btn.addEventListener("click", handler);
    target.appendChild(btn);
  };

  mkBtn("litm-import-challenges", "Import Challenges from JSON",              "Import Challenges", () => _importChallenges());
  mkBtn("litm-import-themes",     "Import Theme Content (theme books, kits, tropes)", "Import Themes",     () => _importThemeContent());
});

async function _importChallenges() {
  const proceed = await new Promise(resolve => {
    new Dialog({
      title: "Import Challenges",
      content: `
        <div style="line-height:1.5;font-size:13px;">
          <p>Import one or more challenges from a <code>.json</code> file into the <strong>Challenges</strong> compendium. The file can contain a single challenge object or an array of objects to import multiple at once.</p>
          <p>Status references like <code>hurt-2</code> in threat and consequence text are wrapped automatically. The compendium is created if it doesn't already exist.</p>
          <p><a href="systems/legend-in-the-mist-foundry/assets/challenge-template.json" target="_blank" style="color:#c9a84c;">Open sample schema ↗</a></p>
        </div>`,
      buttons: {
        import: { label: "Choose File…", callback: () => resolve(true) },
        cancel: { label: "Cancel",       callback: () => resolve(false) },
      },
      default: "import",
      close: () => resolve(false),
    }).render(true);
  });

  if (!proceed) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const entries = Array.isArray(json) ? json : [json];
      if (!entries.length || entries.some(e => typeof e !== "object" || Array.isArray(e)))
        throw new Error("JSON must be a challenge object or an array of challenge objects.");

      const id = () => foundry.utils.randomID();

      const wrapStatuses = text =>
        (text ?? "").replace(/(?<!\[)([a-z]+(?:-[a-z]+)*-\d+)(?!\])/g, "[$1]");

      const buildActorData = raw => {
        const threats      = [];
        const consequences = [];
        for (const t of (raw.threats ?? [])) {
          const threatId = id();
          threats.push({ id: threatId, name: t.name ?? "", description: wrapStatuses(t.description), consequenceIds: [] });
          for (const desc of (t.consequences ?? [])) {
            consequences.push({ id: id(), description: wrapStatuses(desc), linkedThreatId: threatId });
          }
        }
        return {
          name: raw.name ?? "Imported Challenge",
          type: "challenge",
          system: {
            role:        raw.role        ?? "",
            description: raw.description ?? "",
            rating:      raw.rating      ?? 2,
            tags: (raw.tags ?? []).map(t => ({ id: id(), name: t.name ?? "", scratched: t.scratched ?? false, singleUse: t.singleUse ?? false })),
            statuses: (raw.statuses ?? []).map(s => {
              const tier = Math.min(Math.max(parseInt(s.tier) || 1, 1), 6);
              return { id: id(), name: s.name ?? "", tier, markedBoxes: [tier] };
            }),
            limits: (raw.limits ?? []).map(l => ({
              id:             id(),
              name:           l.name           ?? "",
              max:            l.isImmunity ? null : (l.max ?? 3),
              current:        l.current        ?? 0,
              isImmunity:     l.isImmunity     ?? false,
              isProgress:     l.isProgress     ?? false,
              specialFeature: l.specialFeature ?? "",
            })),
            threats,
            consequences,
            specialFeatures: (raw.specialFeatures ?? []).map(f => ({ id: id(), name: f.name ?? "", description: wrapStatuses(f.description) })),
          }
        };
      };

      const pack   = await getOrCreateWorldPack("challenges", "Challenges", "Actor");
      const actors = await Actor.createDocuments(entries.map(buildActorData), { pack: pack.collection });
      const label  = actors.length === 1 ? `"${actors[0].name}"` : `${actors.length} challenges`;
      ui.notifications.info(`${label} imported into the Challenges compendium.`);
    } catch (e) {
      ui.notifications.error(`Challenge import failed: ${e.message}`);
    }
  };
  input.click();
}

async function _importThemeContent() {
  // Fetch the sample schema to display in the dialog
  let sampleSchema = "";
  try {
    sampleSchema = await fetch("systems/legend-in-the-mist-foundry/assets/theme-template.json").then(r => r.text());
  } catch {
    sampleSchema = "(Could not load sample schema.)";
  }

  const proceed = await new Promise(resolve => {
    new Dialog({
      title: "Import Theme Content",
      content: `
        <div style="line-height:1.5;font-size:13px;">
          <p>Import theme books, theme kits, and tropes from a <code>.json</code> file into your world's compendiums. Each type is placed in its own compendium, which is created automatically if it doesn't exist.</p>
          <p>The file must be a JSON object with any combination of the following top-level keys:</p>
          <ul style="margin:4px 0 8px 16px;padding:0;">
            <li><code>themebooks</code> — array of theme book objects</li>
            <li><code>themeKits</code> — array of theme kit objects</li>
            <li><code>tropes</code> — array of trope objects</li>
          </ul>
          <p>Theme kits reference their parent theme book by <code>themebookName</code>. Tropes reference kits by name via <code>presetKits</code> and <code>choiceKits</code>. Names are matched automatically at import time.</p>
          <p><a href="systems/legend-in-the-mist-foundry/assets/theme-template.json" target="_blank" style="color:#c9a84c;">Open sample schema ↗</a></p>
        </div>`,
      buttons: {
        import: { label: "Choose File…", callback: () => resolve(true) },
        cancel: { label: "Cancel",       callback: () => resolve(false) },
      },
      default: "import",
      close: () => resolve(false),
    }).render(true);
  });

  if (!proceed) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      ui.notifications.error("Failed to parse JSON file.");
      return;
    }

    const id = () => foundry.utils.randomID();
    const books  = json.themebooks  ?? [];
    const kits   = json.themeKits   ?? [];
    const tropes = json.tropes      ?? [];

    // Get or create a world compendium for each content type
    const [bookPack, kitPack, tropePack] = await Promise.all([
      books.length  ? getOrCreateWorldPack("theme-books", "Theme Books", "Item") : Promise.resolve(null),
      kits.length   ? getOrCreateWorldPack("theme-kits",  "Theme Kits",  "Item") : Promise.resolve(null),
      tropes.length ? getOrCreateWorldPack("tropes",      "Tropes",      "Item") : Promise.resolve(null),
    ]);

    // Create theme books
    const createdBooks = books.length
      ? await Item.createDocuments(books.map(b => ({
          name:   b.name ?? "Unnamed Theme Book",
          type:   "themebook",
          system: {
            might:               b.might ?? "origin",
            traits:              b.traits ?? [],
            description:         b.description ?? "",
            powerTagQuestions:   (b.powerTagQuestions ?? []).map(q => ({ key: q.key ?? "", question: q.question ?? "" })),
            weaknessTagQuestions:(b.weaknessTagQuestions ?? []).map(q => ({ key: q.key ?? "", question: q.question ?? "" })),
            questIdeas:          b.questIdeas ?? [],
            specialImprovements: (b.specialImprovements ?? []).map(si => ({ id: id(), name: si.name ?? "", description: si.description ?? "" })),
          }
        })), { pack: bookPack.collection })
      : [];

    // Build name→id map for books
    const bookNameToId = {};
    for (let i = 0; i < books.length; i++) {
      if (createdBooks[i]) bookNameToId[books[i].name] = createdBooks[i].id;
    }

    // Create theme kits
    const createdKits = kits.length
      ? await Item.createDocuments(kits.map(k => {
          const bookId = k.themebookId ?? bookNameToId[k.themebookName] ?? "";
          return {
            name:   k.name ?? "Unnamed Theme Kit",
            type:   "themekit",
            system: {
              themebookId:         bookId,
              themebookName:       k.themebookName ?? "",
              might:               k.might ?? "origin",
              titleTag:            k.titleTag ?? "",
              powerTags:           k.powerTags ?? [],
              weaknessTags:        k.weaknessTags ?? [],
              quest:               k.quest ?? "",
              specialImprovements: (k.specialImprovements ?? []).map(si => ({ id: id(), name: si.name ?? "", description: si.description ?? "" })),
            }
          };
        }), { pack: kitPack.collection })
      : [];

    // Build name→id map for kits
    const kitNameToId = {};
    for (let i = 0; i < kits.length; i++) {
      if (createdKits[i]) kitNameToId[kits[i].name] = createdKits[i].id;
    }

    // Create tropes
    const createdTropes = tropes.length
      ? await Item.createDocuments(tropes.map(t => {
          const resolveKit = (nameOrId) => {
            if (!nameOrId) return "";
            return kitNameToId[nameOrId] ?? nameOrId;
          };
          const presetKitIds = (t.presetKits ?? []).map(resolveKit);
          const choiceKitIds = (t.choiceKits ?? []).map(resolveKit);
          while (presetKitIds.length < 3) presetKitIds.push("");
          while (choiceKitIds.length < 3) choiceKitIds.push("");
          return {
            name:   t.name ?? "Unnamed Trope",
            type:   "trope",
            system: {
              description:   t.description ?? "",
              presetKitIds,
              choiceKitIds,
              backpackItems: t.backpackItems ?? [],
            }
          };
        }), { pack: tropePack.collection })
      : [];

    const total = createdBooks.length + createdKits.length + createdTropes.length;
    ui.notifications.info(`Imported ${total} item(s) into compendiums: ${createdBooks.length} theme book(s), ${createdKits.length} theme kit(s), ${createdTropes.length} trope(s).`);
  };
  input.click();
}

// Theme books, kits, and tropes default to observer visibility for all users
Hooks.on("preCreateItem", (item, data) => {
  if (!["themebook", "themekit", "trope"].includes(data.type)) return;
  if (data.ownership) return;
  item.updateSource({ ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
});

// Heroes and fellowships default to observer visibility so all players can view them
Hooks.on("preCreateActor", (actor, data) => {
  if (!["hero", "fellowship"].includes(data.type)) return;
  if (data.ownership) return;
  actor.updateSource({ ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
});

// Initialize new hero actors with 4 empty themes
Hooks.on("preCreateActor", (actor, data) => {
  if (data.type !== "hero") return;
  if (data.system?.themes?.length) return; // already has themes
  const themes = Array.from({ length: 4 }, () => ({
    id:             foundry.utils.randomID(),
    name:           "",
    titleScratched: false,
    themebook:      "",
    might:          "origin",
    powerTags:      [],
    weaknessTags:   [],
    quest:          "",
    improveCount:   0,
    abandonCount:   0,
    milestoneCount: 0,
    improvements:   [],
    specialImprovements: []
  }));
  actor.updateSource({ "system.themes": themes });
});
