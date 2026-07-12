const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ApplyStoryThemeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes:  ["litm", "litm-apply-dialog", "litm-apply-story-theme"],
    position: { width: 460, height: "auto" },
    window:   { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/legend-in-the-mist-foundry/templates/dialogs/apply-story-theme.hbs" }
  };

  get title() { return "Apply Story Theme"; }

  #resolve;
  #selectedUuid = "";
  #storyTheme = null;
  #powerStates = {};
  #weaknessStates = {};

  constructor(resolve, options = {}) {
    super(options);
    this.#resolve = resolve;
  }

  static async show() {
    return new Promise(resolve => {
      new ApplyStoryThemeDialog(resolve).render({ force: true });
    });
  }

  async _prepareContext(options) {
    const allStoryThemes = await _getAllStoryThemes();

    let preview = null;
    if (this.#storyTheme) {
      const s = this.#storyTheme.system;
      preview = {
        description: s.description,
        powerTags: (s.powerTags ?? []).map((name, i) => ({
          name, key: `power-${i}`, on: this.#powerStates[`power-${i}`] === true,
        })),
        weaknessTags: (s.weaknessTags ?? []).map((name, i) => ({
          name, key: `weakness-${i}`, on: this.#weaknessStates[`weakness-${i}`] === true,
        })),
      };
    }

    return { allStoryThemes, selectedUuid: this.#selectedUuid, preview, hasStoryTheme: !!this.#storyTheme };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    el.querySelector(".ad-main-select")?.addEventListener("change", async e => {
      this.#selectedUuid = e.target.value;
      this.#storyTheme = this.#selectedUuid ? await fromUuid(this.#selectedUuid) : null;
      this.#powerStates = {};
      this.#weaknessStates = {};
      this.render();
    });

    for (const pill of el.querySelectorAll(".ad-tag[data-key^='power-']")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#powerStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    for (const pill of el.querySelectorAll(".ad-tag[data-key^='weakness-']")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#weaknessStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    el.querySelector(".ad-apply-btn")?.addEventListener("click", () => {
      if (!this.#storyTheme) return;
      const s = this.#storyTheme.system;
      const selectedPowerTags    = (s.powerTags ?? []).filter((_, i) => this.#powerStates[`power-${i}`] === true);
      const selectedWeaknessTags = (s.weaknessTags ?? []).filter((_, i) => this.#weaknessStates[`weakness-${i}`] === true);
      this.#resolve({ storyTheme: this.#storyTheme, selectedPowerTags, selectedWeaknessTags });
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

async function _getAllStoryThemes() {
  const world = game.items
    .filter(i => i.type === "story-theme")
    .map(i => ({ uuid: i.uuid, name: i.name }));
  const fromPacks = [];
  for (const pack of game.packs.filter(p => p.documentName === "Item")) {
    await pack.getIndex();
    for (const entry of pack.index.filter(e => e.type === "story-theme")) {
      fromPacks.push({ uuid: entry.uuid, name: entry.name });
    }
  }
  return [...world, ...fromPacks];
}
