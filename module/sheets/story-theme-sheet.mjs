const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class StoryThemeSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "item", "story-theme"],
    position: { width: 560, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addPowerTag:        StoryThemeSheet._addPowerTag,
      removePowerTag:     StoryThemeSheet._removePowerTag,
      addWeaknessTag:      StoryThemeSheet._addWeaknessTag,
      removeWeaknessTag:   StoryThemeSheet._removeWeaknessTag,
      addImprovement:      StoryThemeSheet._addImprovement,
      removeImprovement:   StoryThemeSheet._removeImprovement,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/story-theme-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item:    this.item,
      system:  this.item.system,
      isOwner: this.item.isOwner,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root    = this.element.querySelector(".litm-story-theme-sheet");
    const editBtn = this.element.querySelector(".edit-toggle-btn");
    if (!this.hasOwnProperty("_editMode")) this._editMode = false;
    if (root)    root.classList.toggle("is-editing", this._editMode);
    if (editBtn) {
      editBtn.classList.toggle("active", this._editMode);
      editBtn.addEventListener("click", () => {
        this._editMode = !this._editMode;
        root?.classList.toggle("is-editing", this._editMode);
        editBtn.classList.toggle("active", this._editMode);
      });
    }
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _addPowerTag() {
    const tags = [...(this.item.system.powerTags ?? [])];

    // These are plain form inputs (name="system.powerTags.N"), saved via the
    // sheet's own submitOnChange handling rather than a custom listener —
    // same async-update race, so capture unsaved edits by index before appending.
    tags.forEach((_, idx) => {
      const input = this.element.querySelector(`[name="system.powerTags.${idx}"]`);
      if (input) tags[idx] = input.value;
    });

    tags.push("");
    return this.item.update({ "system.powerTags": tags });
  }

  static async _removePowerTag(event, target) {
    const idx  = Number(target.dataset.index);
    const tags = this.item.system.powerTags.filter((_, i) => i !== idx);
    return this.item.update({ "system.powerTags": tags });
  }

  static async _addWeaknessTag() {
    const tags = [...(this.item.system.weaknessTags ?? [])];
    tags.forEach((_, idx) => {
      const input = this.element.querySelector(`[name="system.weaknessTags.${idx}"]`);
      if (input) tags[idx] = input.value;
    });

    tags.push("");
    return this.item.update({ "system.weaknessTags": tags });
  }

  static async _removeWeaknessTag(event, target) {
    const idx  = Number(target.dataset.index);
    const tags = this.item.system.weaknessTags.filter((_, i) => i !== idx);
    return this.item.update({ "system.weaknessTags": tags });
  }

  static async _addImprovement() {
    const sis = foundry.utils.deepClone(this.item.system.specialImprovements ?? []);
    sis.forEach((si, idx) => {
      const nameInput = this.element.querySelector(`[name="system.specialImprovements.${idx}.name"]`);
      if (nameInput) si.name = nameInput.value;
      const descInput = this.element.querySelector(`[name="system.specialImprovements.${idx}.description"]`);
      if (descInput) si.description = descInput.value;
    });

    sis.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.item.update({ "system.specialImprovements": sis });
  }

  static async _removeImprovement(event, target) {
    const sis = this.item.system.specialImprovements.filter(si => si.id !== target.dataset.id);
    return this.item.update({ "system.specialImprovements": sis });
  }
}
