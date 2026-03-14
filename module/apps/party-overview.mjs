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

    const heroes = game.actors
      .filter(a => a.type === "hero")
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

  /* ─── Actions ───────────────────────────────────────── */

  static _openHeroSheet(event, target) {
    game.actors.get(target.dataset.actorId)?.sheet?.render(true);
  }
}
