import { parseInlineRefs } from "../utils.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const JOURNEY_TYPE_LABELS = { landscape: "Landscape", occasion: "Occasion", undertaking: "Undertaking" };

export class JourneySheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "actor", "journey"],
    position: { width: 820, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleEditMode:      JourneySheet._toggleEditMode,
      addGeneralDanger:    JourneySheet._addGeneralDanger,
      removeGeneralDanger: JourneySheet._removeGeneralDanger,
      addTag:              JourneySheet._addTag,
      scratchTag:          JourneySheet._scratchTag,
      addVignette:             JourneySheet._addVignette,
      removeVignette:          JourneySheet._removeVignette,
      moveVignette:            JourneySheet._moveVignette,
      addVignetteConsequence:    JourneySheet._addVignetteConsequence,
      removeVignetteConsequence: JourneySheet._removeVignetteConsequence,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/journey-sheet.hbs",
      scrollY: [".jny-body"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.actor.system;
    const isGM    = game.user.isGM;

    const vignettes = system.vignettes.map(v => ({
      ...v,
      consequences: v.consequences.map(c => ({
        ...c,
        renderedDescription: parseInlineRefs(c.description)
      })),
    }));

    const generalDangers = system.generalDangers.map(d => ({
      ...d,
      renderedDescription: parseInlineRefs(d.description)
    }));

    return {
      ...context,
      actor:  this.actor,
      system,
      isGM,
      journeyTypeLabel: JOURNEY_TYPE_LABELS[system.journeyType] ?? "Landscape",
      vignettes,
      generalDangers,
    };
  }

  /* ─── Actions: General Dangers ──────────────────────── */

  static async _addGeneralDanger() {
    const dangers = foundry.utils.deepClone(this.actor.system.generalDangers);
    const id = foundry.utils.randomID();
    dangers.push({ id, description: "" });
    this._focusConsequenceId = id;
    return this.actor.update({ "system.generalDangers": dangers });
  }

  static async _removeGeneralDanger(event, target) {
    const dangers = this.actor.system.generalDangers.filter(d => d.id !== target.dataset.id);
    return this.actor.update({ "system.generalDangers": dangers });
  }

  /* ─── Actions: top-level Tags ───────────────────────── */

  static async _addTag() {
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    const id = foundry.utils.randomID();
    tags.push({ id, name: "", scratched: false, singleUse: false });
    this._focusTagId = id;
    return this.actor.update({ "system.tags": tags });
  }

  static async _scratchTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    const tag  = tags.find(t => t.id === target.dataset.tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.actor.update({ "system.tags": tags });
  }

  /* ─── Actions: Vignettes ─────────────────────────────── */

  static async _addVignette() {
    const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
    const id = foundry.utils.randomID();
    vignettes.push({ id, name: "", description: "", consequences: [] });
    this._focusVignetteId = id;
    return this.actor.update({ "system.vignettes": vignettes });
  }

  static async _removeVignette(event, target) {
    const vignettes = this.actor.system.vignettes.filter(v => v.id !== target.dataset.vignetteId);
    return this.actor.update({ "system.vignettes": vignettes });
  }

  static async _moveVignette(event, target) {
    const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
    const idx = vignettes.findIndex(v => v.id === target.dataset.vignetteId);
    if (idx === -1) return;
    const swapIdx = idx + (target.dataset.dir === "left" ? -1 : 1);
    if (swapIdx < 0 || swapIdx >= vignettes.length) return;
    [vignettes[idx], vignettes[swapIdx]] = [vignettes[swapIdx], vignettes[idx]];
    return this.actor.update({ "system.vignettes": vignettes });
  }

  static async _addVignetteConsequence(event, target) {
    const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
    const vignette  = vignettes.find(v => v.id === target.dataset.vignetteId);
    if (!vignette) return;
    const id = foundry.utils.randomID();
    vignette.consequences.push({ id, description: "" });
    this._focusConsequenceId = id;
    return this.actor.update({ "system.vignettes": vignettes });
  }

  static async _removeVignetteConsequence(event, target) {
    const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
    const vignette  = vignettes.find(v => v.id === target.dataset.vignetteId);
    if (!vignette) return;
    vignette.consequences = vignette.consequences.filter(c => c.id !== target.dataset.id);
    return this.actor.update({ "system.vignettes": vignettes });
  }

  static _toggleEditMode(event, target) {
    this._editMode = !this._editMode;
    localStorage.setItem(`litm.editMode.journey.${this.actor.id}`, this._editMode);
    this.element.querySelector(".litm-journey-sheet")?.classList.toggle("is-editing", this._editMode);
    target.closest(".jny-edit-toggle")?.classList.toggle("active", this._editMode);
  }

  /* ─── Render ─────────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.hasOwnProperty("_editMode")) {
      const saved = localStorage.getItem(`litm.editMode.journey.${this.actor.id}`);
      this._editMode = saved !== null ? saved === "true" : !this.actor.pack;
    }
    this.element.querySelector(".litm-journey-sheet")?.classList.toggle("is-editing", this._editMode);
    this.element.querySelector(".jny-edit-toggle")?.classList.toggle("active", this._editMode);

    // Top-level tag inline editing
    for (const input of this.element.querySelectorAll(".jny-tag-inp[data-tag-id]")) {
      input.addEventListener("change", async ev => {
        const tags = foundry.utils.deepClone(this.actor.system.tags);
        const name = ev.target.value.trim();
        if (!name) {
          await this.actor.update({ "system.tags": tags.filter(t => t.id !== ev.target.dataset.tagId) });
        } else {
          const tag = tags.find(t => t.id === ev.target.dataset.tagId);
          if (!tag) return;
          tag.name = name;
          await this.actor.update({ "system.tags": tags }, { render: false });
        }
      });
    }

    // Focus newly added top-level tag
    if (this._focusTagId) {
      const id = this._focusTagId;
      this._focusTagId = null;
      const input = this.element.querySelector(`.jny-tag-inp[data-tag-id="${id}"]`);
      if (input) { input.style.pointerEvents = "auto"; input.focus(); }
    }

    // Vignette name inputs
    for (const input of this.element.querySelectorAll(".jny-vignette-name[data-vignette-id]")) {
      input.addEventListener("change", async ev => {
        const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
        const vignette  = vignettes.find(v => v.id === ev.target.dataset.vignetteId);
        if (!vignette) return;
        vignette.name = ev.target.value.trim();
        await this.actor.update({ "system.vignettes": vignettes }, { render: false });
      });
    }

    // Vignette description textareas
    for (const input of this.element.querySelectorAll(".jny-vignette-desc[data-vignette-id]")) {
      input.addEventListener("change", async ev => {
        const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
        const vignette  = vignettes.find(v => v.id === ev.target.dataset.vignetteId);
        if (!vignette) return;
        vignette.description = ev.target.value.trim();
        await this.actor.update({ "system.vignettes": vignettes }, { render: false });
      });
    }

    // Focus newly added vignette
    if (this._focusVignetteId) {
      const id = this._focusVignetteId;
      this._focusVignetteId = null;
      const input = this.element.querySelector(`.jny-vignette-name[data-vignette-id="${id}"]`);
      if (input) input.focus();
    }

    // Consequence-style row display/edit toggle — covers both General
    // Dangers (no vignette ancestor) and per-vignette consequences
    for (const item of this.element.querySelectorAll(".jny-list-row[data-consequence-id]")) {
      const cid     = item.dataset.consequenceId;
      const vid     = item.closest("[data-vignette-id]")?.dataset.vignetteId;
      const display = item.querySelector(".conseq-display");
      const input   = item.querySelector(".conseq-inp");
      if (!display || !input) continue;

      if (!input.value) item.classList.add("editing");

      display.addEventListener("click", () => {
        item.classList.add("editing");
        input.focus();
        input.select();
      });

      input.addEventListener("blur", async ev => {
        if (vid) {
          const vignettes = foundry.utils.deepClone(this.actor.system.vignettes);
          const vignette  = vignettes.find(v => v.id === vid);
          const consequence = vignette?.consequences.find(c => c.id === cid);
          if (!consequence) return;
          consequence.description = ev.target.value;
          await this.actor.update({ "system.vignettes": vignettes }, { render: false });
        } else {
          const dangers = foundry.utils.deepClone(this.actor.system.generalDangers);
          const danger  = dangers.find(d => d.id === cid);
          if (!danger) return;
          danger.description = ev.target.value;
          await this.actor.update({ "system.generalDangers": dangers }, { render: false });
        }
        display.innerHTML = parseInlineRefs(ev.target.value);
        item.classList.remove("editing");
      });
    }

    // Focus newly added consequence
    if (this._focusConsequenceId) {
      const id = this._focusConsequenceId;
      this._focusConsequenceId = null;
      const item = this.element.querySelector(`[data-consequence-id="${id}"]`);
      if (item) {
        item.classList.add("editing");
        const input = item.querySelector(".conseq-inp");
        if (input) { input.style.pointerEvents = "auto"; input.focus(); }
      }
    }
  }

}
