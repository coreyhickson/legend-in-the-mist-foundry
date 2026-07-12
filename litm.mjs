import {
  ChallengeDataModel,
  ChallengeAddonDataModel,
  FellowshipDataModel,
  HeroDataModel,
  JourneyDataModel,
  ThemebookDataModel,
  ThemeKitDataModel,
  TropeDataModel,
  StoryThemeDataModel,
} from "./module/data-models.mjs";
import { LitmActor, LitmItem } from "./module/documents.mjs";
import { HeroSheet }         from "./module/sheets/hero-sheet.mjs";
import { ChallengeSheet }    from "./module/sheets/challenge-sheet.mjs";
import { FellowshipSheet }   from "./module/sheets/fellowship-sheet.mjs";
import { JourneySheet }      from "./module/sheets/journey-sheet.mjs";
import { ThemebookSheet }    from "./module/sheets/themebook-sheet.mjs";
import { ThemeKitSheet }     from "./module/sheets/themekit-sheet.mjs";
import { TropeSheet }        from "./module/sheets/trope-sheet.mjs";
import { ChallengeAddonSheet } from "./module/sheets/challenge-addon-sheet.mjs";
import { StoryThemeSheet }   from "./module/sheets/story-theme-sheet.mjs";
import { LitmSceneTracker }  from "./module/apps/scene-tracker.mjs";
import { LitmPartyOverview } from "./module/apps/party-overview.mjs";
import { LitmCampingScene }  from "./module/apps/camping-scene.mjs";
import { LitmOracle }        from "./module/apps/oracle.mjs";
import { RollPanel }         from "./module/apps/roll-panel.mjs";
import { runOfficialImport } from "./module/importer.mjs";

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
    fellowship:  FellowshipDataModel,
    journey:     JourneyDataModel
  };

  CONFIG.Item.dataModels = {
    themebook:         ThemebookDataModel,
    themekit:          ThemeKitDataModel,
    trope:             TropeDataModel,
    "challenge-addon": ChallengeAddonDataModel,
    "story-theme":     StoryThemeDataModel,
  };


  CONFIG.Actor.trackableAttributes = {
    hero:       { bar: [], value: [] },
    challenge:  { bar: [], value: [] },
    fellowship: { bar: [], value: [] },
    journey:    { bar: [], value: [] }
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

  foundry.documents.collections.Actors.registerSheet("litm", JourneySheet, {
    types: ["journey"],
    makeDefault: true,
    label: "LITM.Sheet.JourneySheet"
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

  foundry.documents.collections.Items.registerSheet("litm", ChallengeAddonSheet, {
    types: ["challenge-addon"],
    makeDefault: true,
    label: "LITM.Item.Types.challenge-addon"
  });

  foundry.documents.collections.Items.registerSheet("litm", StoryThemeSheet, {
    types: ["story-theme"],
    makeDefault: true,
    label: "LITM.Item.Types.story-theme"
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

// ── Import content ──────────────────────────────────────────────────
Hooks.on("renderCompendiumDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const header = html.querySelector ? html.querySelector(".directory-header") : html.find(".directory-header")[0];
  if (!header) return;

  const actions = header.querySelector ? header.querySelector(".header-actions") : null;
  const target  = actions ?? header;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "litm-import-official";
  btn.title = "Import Challenges, Journeys, Theme Books/Kits, Story Themes, and Challenge Addons from a JSON export of another world";
  btn.innerHTML = `<i class="fas fa-file-import"></i> Import Content`;
  btn.style.cssText = "font-size:12px;padding:3px 8px;margin-left:4px;";
  btn.addEventListener("click", () => runOfficialImport());
  target.appendChild(btn);
});

// Theme books, kits, tropes, and story themes default to observer visibility for all users
Hooks.on("preCreateItem", (item, data) => {
  if (!["themebook", "themekit", "trope", "story-theme"].includes(data.type)) return;
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
