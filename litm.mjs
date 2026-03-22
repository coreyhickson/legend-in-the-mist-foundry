import {
  ChallengeDataModel,
  FellowshipDataModel,
  HeroDataModel
} from "./module/data-models.mjs";
import { LitmActor, LitmItem } from "./module/documents.mjs";
import { HeroSheet }         from "./module/sheets/hero-sheet.mjs";
import { ChallengeSheet }    from "./module/sheets/challenge-sheet.mjs";
import { FellowshipSheet }   from "./module/sheets/fellowship-sheet.mjs";
import { LitmSceneTracker }  from "./module/apps/scene-tracker.mjs";
import { LitmPartyOverview } from "./module/apps/party-overview.mjs";
import { LitmCampingScene }  from "./module/apps/camping-scene.mjs";
import { RollPanel }         from "./module/apps/roll-panel.mjs";

const PRELOAD_TEMPLATES = [
  "systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs",
  "systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs",
];

Hooks.once("init", () => {
  console.log("litm | Initializing Legend in the Mist system");

  foundry.applications.handlebars.loadTemplates(PRELOAD_TEMPLATES);

  game.settings.register("legend-in-the-mist-foundry", "partyHeroIds", {
    name: "Active Party Heroes",
    scope: "world",
    config: false,
    type: Object,
    default: null,
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

  // Register eq helper for Handlebars (used in templates)
  Handlebars.registerHelper("eq", (a, b) => a === b);
});

Hooks.once("ready", () => {
  console.log("litm | Legend in the Mist system ready");
  // Expose for macro access: LitmSceneTracker.open()
  game.litm = { sceneTracker: LitmSceneTracker, partyOverview: LitmPartyOverview, campingScene: LitmCampingScene };

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

  if (Array.isArray(controls)) {
    // Pre-v14 format
    const group = controls.find(c => c.name === "token");
    if (group) {
      group.tools.push(sceneTrackerTool);
      group.tools.push(partyOverviewTool);
      group.tools.push(campingTool);
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
  }
});

Hooks.on("updateActor", (actor) => {
  if (actor.type !== "fellowship") return;
  for (const hero of game.actors.filter(a => a.type === "hero" && a.system.fellowshipId === actor.id)) {
    if (hero.sheet?.rendered) hero.sheet.render();
  }
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
