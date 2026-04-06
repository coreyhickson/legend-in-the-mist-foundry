const { ItemSheetV2 }             = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class ThemebookSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "item", "themebook"],
    position: { width: 640, height: 700 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      cycleMight:          ThemebookSheet._cycleMight,
      addTrait:            ThemebookSheet._addTrait,
      removeTrait:         ThemebookSheet._removeTrait,
      addQuestIdea:        ThemebookSheet._addQuestIdea,
      removeQuestIdea:     ThemebookSheet._removeQuestIdea,
      addImprovement:      ThemebookSheet._addImprovement,
      removeImprovement:   ThemebookSheet._removeImprovement,
      openJournal:         ThemebookSheet._openJournal,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/themebook-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.item.system;
    const MIGHT_ICONS = { origin: "🌿", adventure: "⚔️", greatness: "👑" };
    return {
      ...context,
      item:      this.item,
      system,
      mightIcon: MIGHT_ICONS[system.might] ?? "🌿",
      isOwner:   this.item.isOwner,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const el = this.element;

    // Edit mode toggle
    const root    = el.querySelector(".litm-themebook-sheet");
    const editBtn = el.querySelector(".edit-toggle-btn");
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

  static async _cycleMight() {
    const order  = ["origin", "adventure", "greatness"];
    const current = this.item.system.might;
    const next    = order[(order.indexOf(current) + 1) % order.length];
    return this.item.update({ "system.might": next });
  }

  static async _addTrait() {
    const traits = [...(this.item.system.traits ?? []), ""];
    return this.item.update({ "system.traits": traits });
  }

  static async _removeTrait(event, target) {
    const idx    = Number(target.dataset.index);
    const traits = this.item.system.traits.filter((_, i) => i !== idx);
    return this.item.update({ "system.traits": traits });
  }

  static async _addQuestIdea() {
    const ideas = [...(this.item.system.questIdeas ?? []), ""];
    return this.item.update({ "system.questIdeas": ideas });
  }

  static async _removeQuestIdea(event, target) {
    const idx   = Number(target.dataset.index);
    const ideas = this.item.system.questIdeas.filter((_, i) => i !== idx);
    return this.item.update({ "system.questIdeas": ideas });
  }

  static async _addImprovement() {
    const sis = foundry.utils.deepClone(this.item.system.specialImprovements ?? []);
    sis.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.item.update({ "system.specialImprovements": sis });
  }

  static async _removeImprovement(event, target) {
    const sis = this.item.system.specialImprovements.filter(si => si.id !== target.dataset.id);
    return this.item.update({ "system.specialImprovements": sis });
  }

  static async _openJournal() {
    const s         = this.item.system;
    const entryName = this.item.name;

    const mkSection = (heading, questions) => {
      if (!questions?.length) return "";
      const rows = questions.map(q =>
        `<p><strong>${q.key}:</strong> ${q.question}</p><p><em>(answer here)</em></p>`
      ).join("\n");
      return `<h2>${heading}</h2>\n${rows}`;
    };

    const content = [
      s.description ? `<p>${s.description}</p>` : "",
      mkSection("Power Tag Questions", s.powerTagQuestions),
      mkSection("Weakness Tag Questions", s.weaknessTagQuestions),
      s.questIdeas?.length
        ? `<h2>Quest Ideas</h2>\n${s.questIdeas.map(q => `<p>• ${q}</p>`).join("\n")}`
        : "",
    ].filter(Boolean).join("\n");

    // Find existing journal entry or create a new one
    let entry = game.journal.find(j => j.name === entryName);
    if (!entry) {
      entry = await JournalEntry.create({ name: entryName });
      await entry.createEmbeddedDocuments("JournalEntryPage", [{
        name:  entryName,
        type:  "text",
        text:  { content, format: 1 },
      }]);
    }

    entry.sheet.render(true);
  }
}
