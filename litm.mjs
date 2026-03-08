import { LitmActor, LitmItem } from "./module/documents.mjs";
import {
  HeroDataModel,
  ChallengeDataModel,
  FellowshipDataModel,
  StoryTagDataModel,
  ThemebookDataModel
} from "./module/data-models.mjs";

Hooks.once("init", () => {
  console.log("litm | Initializing Legend in the Mist system");

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

  // No traditional HP bars; trackable attributes left empty for now
  CONFIG.Actor.trackableAttributes = {
    hero:       { bar: [], value: [] },
    challenge:  { bar: [], value: [] },
    fellowship: { bar: [], value: [] }
  };

  // TODO Phase 2: register Hero, Challenge, Fellowship sheet classes here
  // Actors.registerSheet("litm", HeroSheet, { types: ["hero"], makeDefault: true });
  // Actors.registerSheet("litm", ChallengeSheet, { types: ["challenge"], makeDefault: true });
  // Actors.registerSheet("litm", FellowshipSheet, { types: ["fellowship"], makeDefault: true });
});

Hooks.once("ready", () => {
  console.log("litm | Legend in the Mist system ready");
});
