const {
  ArrayField, BooleanField, HTMLField, NumberField,
  SchemaField, StringField
} = foundry.data.fields;

/* ─────────────────────────────────────────────────── */
/*  Shared sub-schemas (returned as plain objects so   */
/*  they can be spread into SchemaField definitions)   */
/* ─────────────────────────────────────────────────── */

function tagSchema() {
  return {
    id:        new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
    name:      new StringField({ required: true, blank: true }),
    scratched: new BooleanField({ initial: false }),
    singleUse: new BooleanField({ initial: false })
  };
}

function statusSchema() {
  return {
    id:          new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
    name:        new StringField({ required: true, blank: true }),
    tier:        new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1 }),
    markedBoxes: new ArrayField(new NumberField({ integer: true, min: 1, max: 6 }))
  };
}

function themeSchema() {
  return {
    id:             new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
    name:           new StringField({ blank: true }),
    titleScratched: new BooleanField({ initial: false }),
    themebook:      new StringField({ blank: true }),
    might:          new StringField({ choices: ["origin", "adventure", "greatness"], initial: "origin" }),
    powerTags:      new ArrayField(new SchemaField(tagSchema())),
    weaknessTags:   new ArrayField(new SchemaField(tagSchema())),
    quest:          new StringField({ blank: true }),
    improveCount:   new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
    abandonCount:   new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
    milestoneCount: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
    improvements:   new ArrayField(new StringField({ blank: true })),
    specialImprovements: new ArrayField(new SchemaField({
      id:          new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
      name:        new StringField({ blank: true }),
      description: new StringField({ blank: true })
    }))
  };
}

/* ─────────────────────────────────────────────────── */
/*  Actor Data Models                                  */
/* ─────────────────────────────────────────────────── */

export class HeroDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      trope: new StringField({ blank: true }),

      themes: new ArrayField(new SchemaField(themeSchema())),

      statuses: new ArrayField(new SchemaField(statusSchema())),

      backpack: new ArrayField(new SchemaField({
        id:       new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:     new StringField({ blank: true }),
        scratched: new BooleanField({ initial: false })
      })),

      relationshipTags: new ArrayField(new SchemaField({
        id:            new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        companionId:   new StringField({ blank: true }),
        companionName: new StringField({ blank: true }),
        tag:           new StringField({ blank: true }),
        singleUse:     new BooleanField({ initial: true }),
        scratched:     new BooleanField({ initial: false })
      })),

      promiseCount: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),

      quintessences: new ArrayField(new SchemaField({
        id:     new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:   new StringField({ blank: true }),
        effect: new StringField({ blank: true })
      })),

      // ID of the Fellowship actor linked to this Hero (for inline tag display)
      fellowshipId: new StringField({ blank: true })
    };
  }

  prepareDerivedData() {}
}

export class ChallengeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating:      new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 2 }),
      role:        new StringField({ blank: true }),
      description: new StringField({ blank: true }),
      might:       new StringField({ blank: true }),

      tags:     new ArrayField(new SchemaField(tagSchema())),
      statuses: new ArrayField(new SchemaField(statusSchema())),

      limits: new ArrayField(new SchemaField({
        id:             new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:           new StringField({ blank: true }),
        max:            new NumberField({ integer: true, min: 1, max: 6, nullable: true, initial: 3 }),
        current:        new NumberField({ integer: true, min: 0, max: 6, initial: 0 }),
        isImmunity:     new BooleanField({ initial: false }),
        isProgress:     new BooleanField({ initial: false }),
        specialFeature: new StringField({ blank: true })
      })),

      threats: new ArrayField(new SchemaField({
        id:             new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:           new StringField({ blank: true }),
        description:    new StringField({ blank: true }),
        consequenceIds: new ArrayField(new StringField({ blank: true }))
      })),

      consequences: new ArrayField(new SchemaField({
        id:             new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        description:    new StringField({ blank: true }),
        linkedThreatId: new StringField({ blank: true })
      })),

      specialFeatures: new ArrayField(new SchemaField({
        id:          new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:        new StringField({ blank: true }),
        description: new StringField({ blank: true })
      }))
    };
  }
}

export class FellowshipDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      titleTag:     new SchemaField(tagSchema()),
      powerTags:    new ArrayField(new SchemaField(tagSchema())),
      weaknessTags: new ArrayField(new SchemaField(tagSchema())),
      quest:        new StringField({ blank: true }),

      improveCount:   new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      abandonCount:   new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      milestoneCount: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),

      specialImprovements: new ArrayField(new SchemaField({
        id:          new StringField({ blank: true, initial: () => foundry.utils.randomID() }),
        name:        new StringField({ blank: true }),
        description: new StringField({ blank: true })
      }))
    };
  }
}

/* ─────────────────────────────────────────────────── */
/*  Item Data Models                                   */
/* ─────────────────────────────────────────────────── */

export class StoryTagDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      polarity: new StringField({ choices: ["positive", "negative", "neutral"], initial: "neutral" }),
      scratched: new BooleanField({ initial: false }),
      source:   new StringField({ blank: true }) // actor ID or "scene"
    };
  }
}

export class ThemebookDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      mightCategory: new StringField({
        choices: ["origin", "adventure", "greatness", "any"],
        initial: "origin"
      }),
      themeType:   new StringField({ blank: true }), // e.g. "Skill or Trade", "Relic", etc.
      description: new HTMLField({ required: true, blank: true }),

      specialImprovements: new ArrayField(new SchemaField({
        name:        new StringField({ blank: true }),
        description: new StringField({ blank: true })
      })),

      samplePowerTags:    new ArrayField(new StringField({ blank: true })),
      sampleWeaknessTags: new ArrayField(new StringField({ blank: true }))
    };
  }
}
