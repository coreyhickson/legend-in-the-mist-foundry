const { ItemSheetV2 }             = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class ThemeKitSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "item", "themekit"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      cycleMight:          ThemeKitSheet._cycleMight,
      addPowerTag:         ThemeKitSheet._addPowerTag,
      removePowerTag:      ThemeKitSheet._removePowerTag,
      addWeaknessTag:      ThemeKitSheet._addWeaknessTag,
      removeWeaknessTag:   ThemeKitSheet._removeWeaknessTag,
      openThemeBook:       ThemeKitSheet._openThemeBook,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/themekit-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.item.system;
    const MIGHT_ICONS = { origin: "🌿", adventure: "⚔️", greatness: "👑" };

    // Collect all theme books from world + compendium index for the selector
    const themebooks = _getAllThemebooks();
    const linkedBook = system.themebookId
      ? (game.items.get(system.themebookId) ?? null)
      : null;

    return {
      ...context,
      item:        this.item,
      system,
      mightIcon:   MIGHT_ICONS[system.might] ?? "🌿",
      themebooks,
      linkedBook,
      isOwner:     this.item.isOwner,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const el = this.element;

    // Edit mode toggle
    const root    = el.querySelector(".litm-themekit-sheet");
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

    // Theme book select change — update both id and name
    const bookSelect = el.querySelector(".tk-book-select");
    if (bookSelect) {
      bookSelect.addEventListener("change", async () => {
        const id   = bookSelect.value;
        const name = bookSelect.options[bookSelect.selectedIndex]?.text ?? "";
        await this.item.update({ "system.themebookId": id, "system.themebookName": name });
      });
    }
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _cycleMight() {
    const order   = ["origin", "adventure", "greatness"];
    const current = this.item.system.might;
    const next    = order[(order.indexOf(current) + 1) % order.length];
    return this.item.update({ "system.might": next });
  }

  static async _addPowerTag() {
    const tags = [...(this.item.system.powerTags ?? []), ""];
    return this.item.update({ "system.powerTags": tags });
  }

  static async _removePowerTag(event, target) {
    const idx  = Number(target.dataset.index);
    const tags = this.item.system.powerTags.filter((_, i) => i !== idx);
    return this.item.update({ "system.powerTags": tags });
  }

  static async _addWeaknessTag() {
    const tags = [...(this.item.system.weaknessTags ?? []), ""];
    return this.item.update({ "system.weaknessTags": tags });
  }

  static async _removeWeaknessTag(event, target) {
    const idx  = Number(target.dataset.index);
    const tags = this.item.system.weaknessTags.filter((_, i) => i !== idx);
    return this.item.update({ "system.weaknessTags": tags });
  }

  static async _openThemeBook() {
    const id   = this.item.system.themebookId;
    const book = id ? game.items.get(id) : null;
    if (book) book.sheet.render(true);
    else ui.notifications.warn("No theme book linked or book not found in world.");
  }
}

/* ─── Helpers ──────────────────────────────────────── */

function _getAllThemebooks() {
  const world = game.items
    .filter(i => i.type === "themebook")
    .map(i => ({ id: i.id, name: i.name }));
  const fromPacks = [];
  for (const pack of game.packs.filter(p => p.documentName === "Item")) {
    for (const entry of pack.index.filter(e => e.type === "themebook")) {
      fromPacks.push({ id: `${pack.collection}.${entry._id}`, name: entry.name });
    }
  }
  return [...world, ...fromPacks];
}
