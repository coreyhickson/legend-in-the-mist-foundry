const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LitmPartyOverview extends HandlebarsApplicationMixin(ApplicationV2) {

  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "litm-party-overview",
    classes: ["litm", "party-overview"],
    position: { width: 720, height: 560 },
    window: { resizable: true, title: "Party Overview" },
    actions: {
      openHeroSheet: LitmPartyOverview._openHeroSheet,
      removeHero:    LitmPartyOverview._removeHero,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/apps/party-overview.hbs",
      scrollY: [".po-cards"]
    }
  };

  /* ─── Singleton ─────────────────────────────────────── */

  static open() {
    if (!LitmPartyOverview.instance) {
      LitmPartyOverview.instance = new LitmPartyOverview();
    }
    if (LitmPartyOverview.instance.rendered) return LitmPartyOverview.instance.close();
    LitmPartyOverview.instance.render(true);
    return LitmPartyOverview.instance;
  }

  async close(options) {
    LitmPartyOverview.instance = null;
    return super.close(options);
  }

  /* ─── Context ───────────────────────────────────────── */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isGM    = game.user.isGM;

    const activeIds  = game.settings.get("legend-in-the-mist-foundry", "partyHeroIds");
    const allHeroes  = game.actors.filter(a => a.type === "hero");
    const filtered   = activeIds !== null ? allHeroes.filter(a => activeIds.includes(a.id)) : allHeroes;

    const heroes = filtered
      .map(a => {
        const sys = a.system;

        const weaknessTags = (sys.themes ?? [])
          .flatMap(t => t.weaknessTags ?? [])
          .filter(t => t.name?.trim() && !t.scratched);

        const quests = (sys.themes ?? [])
          .map((t, i) => ({ theme: t.name || `Theme ${i + 1}`, text: t.quest }))
          .filter(q => q.text?.trim());

        const fellowship = sys.fellowshipId
          ? game.actors.get(sys.fellowshipId) ?? null
          : null;

        const fellowshipQuest = fellowship
          ? { theme: fellowship.name, text: fellowship.system?.quest ?? "" }
          : null;

        const statuses = (sys.statuses ?? []).filter(s => s.name?.trim());

        return {
          id:              a.id,
          name:            a.name,
          img:             a.img,
          trope:           sys.trope ?? "",
          weaknessTags,
          statuses,
          quests,
          fellowshipQuest: fellowshipQuest?.text?.trim() ? fellowshipQuest : null,
        };
      });

    return { ...context, isGM, heroes };
  }

  /* ─── Drag & Drop ───────────────────────────────────── */

  _onRender(context, options) {
    if (!game.user.isGM) return;
    const cards = this.element.querySelector(".po-cards");
    cards.addEventListener("dragover", (e) => {
      e.preventDefault();
      cards.classList.add("drag-over");
    });
    cards.addEventListener("dragleave", (e) => {
      if (!cards.contains(e.relatedTarget)) cards.classList.remove("drag-over");
    });
    cards.addEventListener("drop", this._onDropActor.bind(this));
  }

  async _onDropActor(event) {
    event.preventDefault();
    this.element.querySelector(".po-cards")?.classList.remove("drag-over");

    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return; }

    if (data.type !== "Actor") return;
    const actor = await fromUuid(data.uuid);
    if (!actor || actor.type !== "hero") return;

    const ids = game.settings.get("legend-in-the-mist-foundry", "partyHeroIds");
    if (ids === null) return; // all heroes already shown
    if (ids.includes(actor.id)) return;

    await game.settings.set("legend-in-the-mist-foundry", "partyHeroIds", [...ids, actor.id]);
    this.render();
  }

  /* ─── Actions ───────────────────────────────────────── */

  static _openHeroSheet(event, target) {
    game.actors.get(target.dataset.actorId)?.sheet?.render(true);
  }

  static async _removeHero(event, target) {
    const actorId = target.dataset.actorId;
    let ids = game.settings.get("legend-in-the-mist-foundry", "partyHeroIds");

    if (ids === null) {
      // First removal: initialize from all heroes, then exclude this one
      ids = game.actors.filter(a => a.type === "hero").map(a => a.id);
    }

    await game.settings.set("legend-in-the-mist-foundry", "partyHeroIds", ids.filter(id => id !== actorId));
    LitmPartyOverview.instance?.render();
  }
}
