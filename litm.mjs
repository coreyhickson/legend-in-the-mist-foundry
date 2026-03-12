import {
  ChallengeDataModel,
  FellowshipDataModel,
  HeroDataModel,
  StoryTagDataModel,
  ThemebookDataModel
} from "./module/data-models.mjs";
import { LitmActor, LitmItem } from "./module/documents.mjs";
import { HeroSheet }      from "./module/sheets/hero-sheet.mjs";
import { ChallengeSheet }  from "./module/sheets/challenge-sheet.mjs";
import { FellowshipSheet } from "./module/sheets/fellowship-sheet.mjs";

const PRELOAD_TEMPLATES = [
  "systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs",
  "systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs",
];

Hooks.once("init", () => {
  console.log("litm | Initializing Legend in the Mist system");

  foundry.applications.handlebars.loadTemplates(PRELOAD_TEMPLATES);

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
    storyTag:  StoryTagDataModel,
    themebook: ThemebookDataModel
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
