const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ApplyTropeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes:  ["litm", "litm-apply-dialog", "litm-apply-trope"],
    position: { width: 480, height: "auto" },
    window:   { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/legend-in-the-mist-foundry/templates/dialogs/apply-trope.hbs" }
  };

  get title() { return "Apply Trope"; }

  #resolve;
  #selectedTropeId  = "";
  #selectedChoiceId = "";
  #tagStates = {};  // flat map: "preset-0-power-2": true, "choice-weakness-1": true, "backpack-3": true

  constructor(resolve, options = {}) {
    super(options);
    this.#resolve = resolve;
  }

  static async show() {
    return new Promise(resolve => {
      new ApplyTropeDialog(resolve).render({ force: true });
    });
  }

  async _prepareContext(options) {
    const allTropes = game.items.filter(i => i.type === "trope").map(i => ({ id: i.id, name: i.name }));
    const trope     = this.#selectedTropeId ? game.items.get(this.#selectedTropeId) : null;

    let preview = null;
    if (trope) {
      const s      = trope.system;
      const states = this.#tagStates;

      // Preset kit slots — each has toggleable tags
      const presetSlots = (s.presetKitIds ?? []).map((id, i) => {
        if (!id) return { num: i + 1, name: null, hasTags: false, powerTags: [], weaknessTags: [] };
        const kit = game.items.get(id);
        if (!kit) return { num: i + 1, name: "Unknown Kit", hasTags: false, powerTags: [], weaknessTags: [] };
        const ks = kit.system;
        const pTags = (ks.powerTags   ?? []).map((name, j) => ({ name, key: `preset-${i}-power-${j}`,    on: states[`preset-${i}-power-${j}`]    === true }));
        const wTags = (ks.weaknessTags ?? []).map((name, j) => ({ name, key: `preset-${i}-weakness-${j}`, on: states[`preset-${i}-weakness-${j}`] === true }));
        return { num: i + 1, name: kit.name, hasTags: pTags.length + wTags.length > 0, powerTags: pTags, weaknessTags: wTags };
      });

      // Choice kit options
      const choiceKits = (s.choiceKitIds ?? []).filter(Boolean).map(id => ({
        id,
        name:     game.items.get(id)?.name ?? id,
        selected: id === this.#selectedChoiceId,
      }));

      // Tags for the selected choice kit
      let choiceSlot = null;
      if (this.#selectedChoiceId) {
        const choiceKit = game.items.get(this.#selectedChoiceId);
        if (choiceKit) {
          const ks = choiceKit.system;
          const pTags = (ks.powerTags   ?? []).map((name, j) => ({ name, key: `choice-power-${j}`,    on: states[`choice-power-${j}`]    === true }));
          const wTags = (ks.weaknessTags ?? []).map((name, j) => ({ name, key: `choice-weakness-${j}`, on: states[`choice-weakness-${j}`] === true }));
          choiceSlot = { name: choiceKit.name, hasTags: pTags.length + wTags.length > 0, powerTags: pTags, weaknessTags: wTags };
        }
      }

      // Backpack suggestions as toggleable items
      const backpackItems = (s.backpackItems ?? []).filter(Boolean).map((name, i) => ({
        name, key: `backpack-${i}`, on: states[`backpack-${i}`] === true,
      }));

      preview = {
        description: s.description,
        presetSlots,
        choiceKits,
        choiceSlot,
        backpackItems,
      };
    }

    return {
      allTropes,
      selectedTropeId:  this.#selectedTropeId,
      selectedChoiceId: this.#selectedChoiceId,
      preview,
      hasApply: !!trope,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    // Trope selector
    el.querySelector(".ad-main-select")?.addEventListener("change", e => {
      this.#selectedTropeId  = e.target.value;
      this.#selectedChoiceId = "";
      this.#tagStates = {};
      this.render();
    });

    // Choice kit radio buttons — re-render to show that kit's tags
    for (const radio of el.querySelectorAll("input[name='trope-choice']")) {
      radio.addEventListener("change", () => {
        if (radio.value === this.#selectedChoiceId) return;
        // Preserve non-choice tag states
        const next = {};
        for (const [k, v] of Object.entries(this.#tagStates)) {
          if (!k.startsWith("choice-")) next[k] = v;
        }
        this.#tagStates        = next;
        this.#selectedChoiceId = radio.value;
        this.render();
      });
    }

    // Tag and backpack pill toggles
    for (const pill of el.querySelectorAll(".ad-tag[data-key]")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#tagStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    el.querySelector(".ad-apply-btn")?.addEventListener("click", () => {
      const trope = this.#selectedTropeId ? game.items.get(this.#selectedTropeId) : null;
      if (!trope) return;
      const s = trope.system;

      const hasChoiceKits = (s.choiceKitIds ?? []).filter(Boolean).length > 0;
      if (hasChoiceKits && !this.#selectedChoiceId) {
        ui.notifications.warn("Please select a choice kit.");
        return;
      }

      // Per-preset-slot tag selections
      const presetIds = (s.presetKitIds ?? []).filter(Boolean);
      const presetSelections = presetIds.map((id, i) => {
        const kit = game.items.get(id);
        if (!kit) return { selectedPower: [], selectedWeakness: [] };
        const ks = kit.system;
        return {
          selectedPower:    (ks.powerTags   ?? []).filter((_, j) => this.#tagStates[`preset-${i}-power-${j}`]    === true),
          selectedWeakness: (ks.weaknessTags ?? []).filter((_, j) => this.#tagStates[`preset-${i}-weakness-${j}`] === true),
        };
      });

      // Choice kit tag selections
      let choiceSelection = null;
      if (this.#selectedChoiceId) {
        const choiceKit = game.items.get(this.#selectedChoiceId);
        if (choiceKit) {
          const ks = choiceKit.system;
          choiceSelection = {
            selectedPower:    (ks.powerTags   ?? []).filter((_, j) => this.#tagStates[`choice-power-${j}`]    === true),
            selectedWeakness: (ks.weaknessTags ?? []).filter((_, j) => this.#tagStates[`choice-weakness-${j}`] === true),
          };
        }
      }

      // Selected backpack items
      const selectedBackpack = (s.backpackItems ?? []).filter(Boolean).filter((_, i) => this.#tagStates[`backpack-${i}`] === true);

      this.#resolve({
        trope,
        choiceId: this.#selectedChoiceId,
        presetSelections,
        choiceSelection,
        selectedBackpack,
      });
      this.#resolve = null;
      this.close();
    });

    el.querySelector(".ad-cancel-btn")?.addEventListener("click", () => {
      this.#resolve?.(null);
      this.#resolve = null;
      this.close();
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    this.#resolve = null;
    return super.close(options);
  }
}
