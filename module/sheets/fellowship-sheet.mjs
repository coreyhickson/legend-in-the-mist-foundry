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
      editTagGroup:         FellowshipSheet._editTagGroup,
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
    const titleTag = foundry.utils.deepClone(this.actor.system.titleTag);
    titleTag.scratched = !titleTag.scratched;
    return this.actor.update({ "system.titleTag": titleTag });
  }

  static async _addTag(event, target) {
    const { collection } = target.dataset;
    const label = collection === "powerTags" ? "New power tag:" : "New weakness tag:";
    const name = await FellowshipSheet._prompt(label);
    if (!name) return;
    const tags = foundry.utils.deepClone(this.actor.system[collection]);
    tags.push({ id: foundry.utils.randomID(), name, scratched: false, singleUse: collection === "powerTags" });
    return this.actor.update({ [`system.${collection}`]: tags });
  }

  static async _scratchTag(event, target) {
    const { collection, tagId } = target.dataset;
    const tags = foundry.utils.deepClone(this.actor.system[collection]);
    const tag  = tags.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.actor.update({ [`system.${collection}`]: tags });
  }

  static async _editTagGroup(event, target) {
    const { collection } = target.dataset;
    const tags  = foundry.utils.deepClone(this.actor.system[collection]);
    const label = collection === "powerTags" ? "Power Tags" : "Weakness Tags";
    if (!tags.length) return;

    const rows = tags.map(t =>
      `<div class="litm-tag-row" data-id="${t.id}" style="display:table;width:100%;margin-bottom:6px;table-layout:fixed;">
        <div style="display:table-cell;width:100%;padding-right:6px;">
          <input type="text" value="${t.name}" style="width:100%;box-sizing:border-box;padding:3px 6px;font-size:13px;">
        </div>
        <div style="display:table-cell;width:24px;vertical-align:middle;text-align:center;">
          <button type="button" class="litm-tag-del" style="background:none;border:none;cursor:pointer;font-size:13px;opacity:0.5;padding:0;line-height:1;">✕</button>
        </div>
      </div>`
    ).join("");

    const saved = await new Promise(resolve => {
      const d = new Dialog({
        title: `Edit ${label}`,
        content: `<div id="litm-tag-list" style="padding:6px 0 4px;width:100%;box-sizing:border-box;">${rows}</div>`,
        buttons: {
          save:   { label: "Save",   callback: html => resolve(html) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "save",
        render:  html => {
          html.find(".litm-tag-del").on("click", function() { $(this).closest(".litm-tag-row").remove(); });
          setTimeout(() => html.find("input").first().focus().select(), 0);
        },
        close: () => resolve(null),
      });
      d.render(true);
    });

    if (!saved) return;
    const updated = [];
    saved.find(".litm-tag-row").each(function() {
      const id   = this.dataset.id;
      const name = $(this).find("input").val().trim();
      if (!name) return;
      const orig = tags.find(t => t.id === id);
      updated.push({ id, name, scratched: orig?.scratched ?? false, singleUse: orig?.singleUse ?? (collection === "powerTags") });
    });
    return this.actor.update({ [`system.${collection}`]: updated });
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

    // Quest input
    const questInput = this.element.querySelector(".fs-quest");
    if (questInput) {
      questInput.addEventListener("change", async ev => {
        await this.actor.update({ "system.quest": ev.target.value.trim() });
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
