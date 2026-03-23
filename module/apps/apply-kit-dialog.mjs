const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { _getAllThemeKits } from "../sheets/trope-sheet.mjs";

export class ApplyKitDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes:  ["litm", "litm-apply-dialog", "litm-apply-kit"],
    position: { width: 460, height: "auto" },
    window:   { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/legend-in-the-mist-foundry/templates/dialogs/apply-kit.hbs" }
  };

  get title() { return "Apply Theme Kit"; }

  #resolve;
  #selectedKitId = "";
  #tagStates = {};  // key -> true means selected; absent or false means deselected

  constructor(resolve, options = {}) {
    super(options);
    this.#resolve = resolve;
  }

  static async show() {
    return new Promise(resolve => {
      new ApplyKitDialog(resolve).render({ force: true });
    });
  }

  async _prepareContext(options) {
    const allKits = _getAllThemeKits();
    const kit     = this.#selectedKitId ? game.items.get(this.#selectedKitId) : null;

    let preview = null;
    if (kit) {
      const s      = kit.system;
      const states = this.#tagStates;
      preview = {
        titleTag:     s.titleTag || kit.name,
        themebookName: s.themebookName,
        quest:        s.quest,
        powerTags:    (s.powerTags ?? []).map((name, i) => ({
          name, key: `power-${i}`, on: states[`power-${i}`] === true,
        })),
        weaknessTags: (s.weaknessTags ?? []).map((name, i) => ({
          name, key: `weakness-${i}`, on: states[`weakness-${i}`] === true,
        })),
      };
    }

    return { allKits, selectedKitId: this.#selectedKitId, preview, hasKit: !!kit };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    el.querySelector(".ad-main-select")?.addEventListener("change", e => {
      this.#selectedKitId = e.target.value;
      this.#tagStates = {};
      this.render();
    });

    for (const pill of el.querySelectorAll(".ad-tag[data-key]")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#tagStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    el.querySelector(".ad-apply-btn")?.addEventListener("click", () => {
      const kit = this.#selectedKitId ? game.items.get(this.#selectedKitId) : null;
      if (!kit) return;
      const s = kit.system;
      const selectedPower    = (s.powerTags   ?? []).filter((_, i) => this.#tagStates[`power-${i}`]   === true);
      const selectedWeakness = (s.weaknessTags ?? []).filter((_, i) => this.#tagStates[`weakness-${i}`] === true);
      this.#resolve({ kit, selectedPower, selectedWeakness });
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
