const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ApplyAddonDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes:  ["litm", "litm-apply-dialog", "litm-apply-addon"],
    position: { width: 460, height: "auto" },
    window:   { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/legend-in-the-mist-foundry/templates/dialogs/apply-addon.hbs" }
  };

  get title() { return "Apply Challenge Addon"; }

  #resolve;
  #selectedUuid = "";
  #addon = null;
  #tagStates = {};
  #statusStates = {};

  constructor(resolve, options = {}) {
    super(options);
    this.#resolve = resolve;
  }

  static async show() {
    return new Promise(resolve => {
      new ApplyAddonDialog(resolve).render({ force: true });
    });
  }

  async _prepareContext(options) {
    const allAddons = await _getAllChallengeAddons();

    let preview = null;
    if (this.#addon) {
      const s      = this.#addon.system;
      preview = {
        description:     s.description,
        ratingIncrease:  s.ratingIncrease,
        roles:           s.roles ?? [],
        tags: (s.tags ?? []).map((t, i) => ({
          name: t.name, key: `tag-${i}`, on: this.#tagStates[`tag-${i}`] === true,
        })),
        statuses: (s.statuses ?? []).map((st, i) => ({
          name: `${st.name}-${st.tier}`, key: `status-${i}`, on: this.#statusStates[`status-${i}`] === true,
        })),
        limits:          (s.limits ?? []).map(l => l.name).filter(Boolean),
        specialFeatures: (s.specialFeatures ?? []).map(f => f.name).filter(Boolean),
        secrets:         (s.secrets ?? []).map(x => x.name).filter(Boolean),
        threats:         (s.threats ?? []).map(t => t.name).filter(Boolean),
      };
    }

    return { allAddons, selectedUuid: this.#selectedUuid, preview, hasAddon: !!this.#addon };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    el.querySelector(".ad-main-select")?.addEventListener("change", async e => {
      this.#selectedUuid = e.target.value;
      this.#addon = this.#selectedUuid ? await fromUuid(this.#selectedUuid) : null;
      this.#tagStates = {};
      this.#statusStates = {};
      this.render();
    });

    for (const pill of el.querySelectorAll(".ad-tag[data-key^='tag-']")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#tagStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    for (const pill of el.querySelectorAll(".ad-tag[data-key^='status-']")) {
      pill.addEventListener("click", () => {
        const key = pill.dataset.key;
        const isOn = !pill.classList.contains("off");
        this.#statusStates[key] = !isOn;
        pill.classList.toggle("off", isOn);
      });
    }

    el.querySelector(".ad-apply-btn")?.addEventListener("click", () => {
      if (!this.#addon) return;
      const s = this.#addon.system;
      const selectedTags = (s.tags ?? []).filter((_, i) => this.#tagStates[`tag-${i}`] === true);
      const selectedStatuses = (s.statuses ?? []).filter((_, i) => this.#statusStates[`status-${i}`] === true);
      this.#resolve({ addon: this.#addon, selectedTags, selectedStatuses });
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

async function _getAllChallengeAddons() {
  const world = game.items
    .filter(i => i.type === "challenge-addon")
    .map(i => ({ uuid: i.uuid, name: i.name }));
  const fromPacks = [];
  for (const pack of game.packs.filter(p => p.documentName === "Item")) {
    await pack.getIndex();
    for (const entry of pack.index.filter(e => e.type === "challenge-addon")) {
      fromPacks.push({ uuid: entry.uuid, name: entry.name });
    }
  }
  return [...world, ...fromPacks];
}
