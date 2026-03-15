const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class FellowshipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "actor", "fellowship"],
    position: { width: 620, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      setTitleTag:          FellowshipSheet._setTitleTag,
      scratchTitleTag:      FellowshipSheet._scratchTitleTag,
      addTag:               FellowshipSheet._addTag,
      scratchTag:           FellowshipSheet._scratchTag,
      setTrack:             FellowshipSheet._setTrack,
      addSpecialImprovement:    FellowshipSheet._addSpecialImprovement,
      removeSpecialImprovement: FellowshipSheet._removeSpecialImprovement,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/fellowship-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.actor.system;

    return {
      ...context,
      actor:  this.actor,
      system,
      abandonDots:   this._buildDots(system.abandonCount,   3),
      improveDots:   this._buildDots(system.improveCount,   3),
      milestoneDots: this._buildDots(system.milestoneCount, 3),
    };
  }

  _buildDots(count, max) {
    return Array.from({ length: max }, (_, i) => ({
      value:  i + 1,
      filled: i < count,
    }));
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _setTitleTag(event, target) {
    const current = this.actor.system.titleTag?.name ?? "";
    const name = await FellowshipSheet._prompt("Title tag:", current);
    if (name === null) return;
    const titleTag = foundry.utils.deepClone(this.actor.system.titleTag);
    titleTag.name = name;
    return this.actor.update({ "system.titleTag": titleTag });
  }

  static async _scratchTitleTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const titleTag = foundry.utils.deepClone(this.actor.system.titleTag);
    titleTag.scratched = !titleTag.scratched;
    return this.actor.update({ "system.titleTag": titleTag });
  }

  static async _addTag(event, target) {
    const result = await new Promise(resolve => {
      new Dialog({
        title: "Add Tag",
        content: `<div style="padding:4px 0 8px">
          <div style="margin-bottom:8px">
            <label><input type="radio" name="tagType" value="powerTags" checked> ${game.i18n.localize('LITM.Tag.Power')}</label>
            <label style="margin-left:12px"><input type="radio" name="tagType" value="weaknessTags"> ${game.i18n.localize('LITM.Tag.Weakness')}</label>
          </div>
          <input id="litm-tag-name" type="text" style="width:100%" placeholder="Tag name…">
        </div>`,
        buttons: {
          add:    { label: "Add",    callback: html => resolve({ type: html.find("[name=tagType]:checked").val(), name: html.find("#litm-tag-name").val().trim() }) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "add",
        render: html => { setTimeout(() => html.find("#litm-tag-name").focus(), 0); },
        close: () => resolve(null),
      }).render(true);
    });
    if (!result?.name) return;
    const id = foundry.utils.randomID();
    const tags = foundry.utils.deepClone(this.actor.system[result.type]);
    tags.push({ id, name: result.name, scratched: false, singleUse: result.type === "powerTags" });
    this._focusTagId = { id, collection: result.type };
    return this.actor.update({ [`system.${result.type}`]: tags });
  }

  static async _scratchTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const { collection, tagId } = target.dataset;
    const tags = foundry.utils.deepClone(this.actor.system[collection]);
    const tag  = tags.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.actor.update({ [`system.${collection}`]: tags });
  }

  static async _setTrack(event, target) {
    const { track, value } = target.dataset;
    const current = this.actor.system[track];
    return this.actor.update({ [`system.${track}`]: current === Number(value) ? 0 : Number(value) });
  }

  static async _addSpecialImprovement(event, target) {
    const sis = foundry.utils.deepClone(this.actor.system.specialImprovements);
    sis.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.actor.update({ "system.specialImprovements": sis });
  }

  static async _removeSpecialImprovement(event, target) {
    const sis = this.actor.system.specialImprovements.filter(s => s.id !== target.dataset.id);
    return this.actor.update({ "system.specialImprovements": sis });
  }

  /* ─── Render ───────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    // Edit mode toggle
    const sheetEl = this.element.querySelector('.litm-fellowship-sheet');
    const editBtn = this.element.querySelector('.fs-edit-toggle');
    if (!this.hasOwnProperty('_editMode')) {
      const saved = localStorage.getItem(`litm.editMode.fellowship.${this.actor.id}`);
      this._editMode = saved !== null ? saved === 'true' : true;
    }
    if (sheetEl) sheetEl.classList.toggle('is-editing', this._editMode);
    if (editBtn) {
      editBtn.classList.toggle('active', this._editMode);
      editBtn.addEventListener('click', () => {
        this._editMode = !this._editMode;
        localStorage.setItem(`litm.editMode.fellowship.${this.actor.id}`, this._editMode);
        sheetEl?.classList.toggle('is-editing', this._editMode);
        editBtn.classList.toggle('active', this._editMode);
      });
    }

    // Quest input
    const questInput = this.element.querySelector(".fs-quest");
    if (questInput) {
      questInput.addEventListener("change", async ev => {
        await this.actor.update({ "system.quest": ev.target.value.trim() });
      });
    }

    // Tag inline editing (delete if cleared)
    for (const input of this.element.querySelectorAll(".fs-tag-inp[data-tag-id]")) {
      input.addEventListener("change", async ev => {
        const { collection, tagId } = ev.target.dataset;
        const tags = foundry.utils.deepClone(this.actor.system[collection]);
        const name = ev.target.value.trim();
        if (!name) {
          await this.actor.update({ [`system.${collection}`]: tags.filter(t => t.id !== tagId) });
        } else {
          const tag = tags.find(t => t.id === tagId);
          if (tag) tag.name = name;
          await this.actor.update({ [`system.${collection}`]: tags });
        }
      });
    }

    // Focus newly added tag
    if (this._focusTagId) {
      const { id, collection } = this._focusTagId;
      this._focusTagId = null;
      const input = this.element.querySelector(`.fs-tag-inp[data-tag-id="${id}"]`);
      if (input) { input.style.pointerEvents = "auto"; input.focus(); input.select(); }
    }

    // Title tag inline editing
    for (const input of this.element.querySelectorAll(".fs-title-inp")) {
      input.addEventListener("change", async ev => {
        const titleTag = foundry.utils.deepClone(this.actor.system.titleTag);
        titleTag.name = ev.target.value.trim();
        await this.actor.update({ "system.titleTag": titleTag });
      });
    }

    // Special improvement inputs
    for (const input of this.element.querySelectorAll(".si-name, .si-desc")) {
      input.addEventListener("change", async ev => {
        const sis = foundry.utils.deepClone(this.actor.system.specialImprovements);
        const si  = sis.find(s => s.id === ev.target.dataset.siId);
        if (!si) return;
        si[ev.target.classList.contains("si-name") ? "name" : "description"] = ev.target.value.trim();
        await this.actor.update({ "system.specialImprovements": sis });
      });
    }
  }

  /* ─── Utility ─────────────────────────────────────── */

  static _prompt(label, defaultValue = "") {
    return new Promise(resolve => {
      new Dialog({
        title: label,
        content: `<div style="padding:4px 0 8px"><input id="litm-prompt" type="text" value="${defaultValue}" style="width:100%"></div>`,
        buttons: {
          ok:     { label: "OK",     callback: html => resolve(html.find("#litm-prompt").val().trim() || null) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        render:  html => { setTimeout(() => html.find("#litm-prompt").focus().select(), 0); },
        close:   () => resolve(null),
      }).render(true);
    });
  }
}
