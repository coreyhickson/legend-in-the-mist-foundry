const { ItemSheetV2 }             = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class TropeSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "item", "trope"],
    position: { width: 560, height: 580 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addBackpackItem:    TropeSheet._addBackpackItem,
      removeBackpackItem: TropeSheet._removeBackpackItem,
      openKit:            TropeSheet._openKit,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/trope-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.item.system;

    const allKits = _getAllThemeKits();

    // Resolve kit names for the 3 preset and 3 choice slots
    const resolveSlot = (id) => {
      if (!id) return { id: "", name: "", exists: false };
      const found = allKits.find(k => k.id === id);
      return { id, name: found?.name ?? id, exists: !!game.items.get(id) };
    };

    const presetSlots = [0, 1, 2].map(i => ({ ...resolveSlot(system.presetKitIds[i] ?? ""), label: String(i + 1) }));
    const choiceSlots = [0, 1, 2].map(i => ({ ...resolveSlot(system.choiceKitIds[i] ?? ""), label: ["A", "B", "C"][i] }));

    return {
      ...context,
      item:        this.item,
      system,
      allKits,
      presetSlots,
      choiceSlots,
      isOwner:     this.item.isOwner,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const el = this.element;

    // Edit mode toggle
    const root    = el.querySelector(".litm-trope-sheet");
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

    // Preset kit selects
    for (const sel of el.querySelectorAll(".ts-preset-select[data-slot-index]")) {
      sel.addEventListener("change", async () => {
        const idx  = Number(sel.dataset.slotIndex);
        const ids  = foundry.utils.deepClone(this.item.system.presetKitIds ?? ["", "", ""]);
        while (ids.length < 3) ids.push("");
        ids[idx] = sel.value;
        await this.item.update({ "system.presetKitIds": ids });
      });
    }

    // Choice kit selects
    for (const sel of el.querySelectorAll(".ts-choice-select[data-slot-index]")) {
      sel.addEventListener("change", async () => {
        const idx  = Number(sel.dataset.slotIndex);
        const ids  = foundry.utils.deepClone(this.item.system.choiceKitIds ?? ["", "", ""]);
        while (ids.length < 3) ids.push("");
        ids[idx] = sel.value;
        await this.item.update({ "system.choiceKitIds": ids });
      });
    }
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _addBackpackItem() {
    const items = [...(this.item.system.backpackItems ?? []), ""];
    return this.item.update({ "system.backpackItems": items });
  }

  static async _removeBackpackItem(event, target) {
    const idx   = Number(target.dataset.index);
    const items = this.item.system.backpackItems.filter((_, i) => i !== idx);
    return this.item.update({ "system.backpackItems": items });
  }

  static async _openKit(event, target) {
    const id  = target.dataset.kitId;
    const kit = id ? game.items.get(id) : null;
    if (kit) kit.sheet.render(true);
    else ui.notifications.warn("Theme kit not found in world.");
  }
}

/* ─── Helpers ──────────────────────────────────────── */

export function _getAllThemeKits() {
  const world = game.items
    .filter(i => i.type === "themekit")
    .map(i => ({ id: i.id, name: i.name }));
  const fromPacks = [];
  for (const pack of game.packs.filter(p => p.documentName === "Item")) {
    for (const entry of pack.index.filter(e => e.type === "themekit")) {
      fromPacks.push({ id: `${pack.collection}.${entry._id}`, name: entry.name });
    }
  }
  return [...world, ...fromPacks];
}
