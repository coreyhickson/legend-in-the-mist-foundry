import {
  ChallengeDataModel,
  FellowshipDataModel,
  HeroDataModel,
  StoryTagDataModel,
  ThemebookDataModel
} from "./module/data-models.mjs";
import { LitmActor, LitmItem } from "./module/documents.mjs";
import { HeroSheet } from "./module/sheets/hero-sheet.mjs";

const PRELOAD_TEMPLATES = [
  "systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs",
  "systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs",
];

Hooks.once("init", () => {
  console.log("litm | Initializing Legend in the Mist system");

  loadTemplates(PRELOAD_TEMPLATES);

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
  Actors.registerSheet("litm", HeroSheet, {
    types: ["hero"],
    makeDefault: true,
    label: "LITM.Sheet.HeroSheet"
  });

  // TODO Phase 4: register Challenge and Fellowship sheets

  // Register eq helper for Handlebars (used in templates)
  Handlebars.registerHelper("eq", (a, b) => a === b);
});

Hooks.once("ready", () => {
  console.log("litm | Legend in the Mist system ready");
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
