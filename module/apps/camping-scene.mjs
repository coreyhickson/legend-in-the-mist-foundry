const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = "legend-in-the-mist-foundry";

export class LitmCampingScene extends HandlebarsApplicationMixin(ApplicationV2) {

  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "litm-camping-scene",
    classes: ["litm", "camping-scene"],
    position: { width: 700, height: 620 },
    window: { resizable: true, title: "Camping Scene" },
    actions: {
      toggleType:          LitmCampingScene._toggleType,
      addThirdActivity:    LitmCampingScene._addThirdActivity,
      removeThirdActivity: LitmCampingScene._removeThirdActivity,
      setFellowshipChoice: LitmCampingScene._setFellowshipChoice,
      endCamping:          LitmCampingScene._endCamping,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/apps/camping-scene.hbs",
      scrollY: [".cs-body"]
    }
  };

  /* ─── Singleton ─────────────────────────────────────── */

  static open({ fromSocket = false } = {}) {
    if (!LitmCampingScene.instance) {
      LitmCampingScene.instance = new LitmCampingScene();
    }
    if (LitmCampingScene.instance.rendered) {
      if (fromSocket) return;
      return LitmCampingScene.instance.close();
    }
    if (!fromSocket) {
      game.socket.emit(`system.${FLAG_SCOPE}`, { type: "campingOpen" });
    }
    LitmCampingScene.instance.render(true);
    return LitmCampingScene.instance;
  }

  async close(options) {
    LitmCampingScene.instance = null;
    return super.close(options);
  }

  /* ─── Flag helpers ───────────────────────────────────── */

  static _getFlags() {
    return foundry.utils.deepClone(
      canvas.scene?.flags?.[FLAG_SCOPE]?.camping ?? {}
    );
  }

  // Serialised save queue — each entry reads fresh flags then applies its mutation,
  // preventing concurrent handlers from overwriting each other with stale data.
  static _saveQueue = Promise.resolve();

  static _save(mutator) {
    LitmCampingScene._saveQueue = LitmCampingScene._saveQueue
      .catch(() => {})
      .then(async () => {
        const camping = LitmCampingScene._getFlags();
        mutator(camping);
        if (game.user.isGM) {
          return canvas.scene?.setFlag(FLAG_SCOPE, "camping", camping);
        }
        game.socket.emit(`system.${FLAG_SCOPE}`, { type: "campingSave", camping });
      });
    return LitmCampingScene._saveQueue;
  }

  static _defaultHeroState() {
    return {
      backpackExpiries:         [],
      activities:               [
        { activity: null, detail: "", reflectTarget: null, restChoices: {} },
        { activity: null, detail: "", reflectTarget: null, restChoices: {} },
        { activity: null, detail: "", reflectTarget: null, restChoices: {} },
      ],
      fellowshipChoice:         null,
      fellowshipTagId:          null,
      fellowshipRelTagName:     "",
      fellowshipRelPartnerName: "",
    };
  }

  static _ensureHeroState(camping, heroId) {
    if (!camping.heroStates) camping.heroStates = {};
    if (!camping.heroStates[heroId]) {
      camping.heroStates[heroId] = LitmCampingScene._defaultHeroState();
    }
    const acts = camping.heroStates[heroId].activities;
    while (acts.length < 3) acts.push({ activity: null, detail: "", reflectTarget: null, restChoices: {} });
    for (const act of acts) {
      if (act.reflectTarget === undefined) act.reflectTarget = null;
      if (!act.restChoices) act.restChoices = {};
    }
    return camping.heroStates[heroId];
  }

  /* ─── Context ────────────────────────────────────────── */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const flags   = LitmCampingScene._getFlags();

    const hasScene          = !!canvas.scene;
    const active            = flags.active ?? true;
    const type              = flags.type ?? "camp";
    const sojourDuration    = flags.sojourDuration ?? "days";
    const thirdPeriodActive = flags.thirdPeriodActive ?? false;
    const heroStates        = flags.heroStates ?? {};
    const isCamp            = type === "camp";
    const sojourPowerBonus  = isCamp ? 0 : { days: 1, weeks: 2, months: 3 }[sojourDuration] ?? 0;

    const activeIds  = game.settings.get(FLAG_SCOPE, "partyHeroIds");
    const allHeroes  = game.actors.filter(a => a.type === "hero");
    const heroActors = activeIds !== null
      ? allHeroes.filter(a => activeIds.includes(a.id))
      : allHeroes;

    const heroes = heroActors.map(actor => {
      const sys    = actor.system;
      const state  = heroStates[actor.id] ?? LitmCampingScene._defaultHeroState();

      const canEdit = actor.testUserPermission(game.user, "OWNER") || game.user.isGM;

      const backpackItems = (sys.backpack ?? []).map(item => ({
        ...item,
        markedForExpiry: (state.backpackExpiries ?? []).includes(item.id),
      }));

      const fellowship = sys.fellowshipId
        ? game.actors.get(sys.fellowshipId) ?? null
        : null;

      // Targets available for Reflect
      const improveTargets = [
        ...(sys.themes ?? []).filter(t => t.name?.trim()).map(t => ({ id: `theme:${t.id}`, name: t.name })),
        ...(fellowship ? [{ id: `fellowship:${fellowship.id}`, name: `Fellowship: ${fellowship.name}` }] : []),
      ];

      // Statuses for inline Rest display
      const rawStatuses = (sys.statuses ?? []).filter(s => s.name?.trim());

      const acts = (state.activities ?? []).slice();
      while (acts.length < 3) acts.push({ activity: null, detail: "", reflectTarget: null, restChoices: {} });

      const periodCount    = thirdPeriodActive ? 3 : 2;
      const activityPeriods = acts.slice(0, periodCount).map((a, i) => {
        const restChoices = a.restChoices ?? {};
        const statuses = rawStatuses.map(s => {
          const c = restChoices[s.id] ?? { action: "", amount: 1 };
          return { ...s, restAction: c.action ?? "", restAmount: c.amount ?? 1 };
        });
        return {
          index:         i,
          activity:      a.activity ?? "",
          detail:        a.detail   ?? "",
          isRest:        a.activity === "rest",
          isReflect:     a.activity === "reflect",
          isCampAction:  a.activity === "campAction",
          reflectTarget: a.reflectTarget ?? "",
          improveTargets,
          statuses,
        };
      });

      const titleTag = fellowship?.system.titleTag;
      const recoverableTags = fellowship ? [
        ...(titleTag?.scratched ? [{ ...titleTag, kind: "title" }] : []),
        ...(fellowship.system.powerTags   ?? []).filter(t => t.scratched).map(t => ({ ...t, kind: "power"   })),
        ...(fellowship.system.weaknessTags ?? []).filter(t => t.scratched).map(t => ({ ...t, kind: "weakness" })),
      ] : [];

      const fellowshipTagName = recoverableTags.find(t => t.id === state.fellowshipTagId)?.name ?? null;

      return {
        id:                   actor.id,
        name:                 actor.name,
        img:                  actor.img,
        canEdit,
        backpackItems,
        hasBackpack:          backpackItems.length > 0,
        activityPeriods,
        hasFellowship:        !!fellowship,
        fellowshipName:       fellowship?.name ?? null,
        recoverableTags,
        fellowshipChoice:        state.fellowshipChoice     ?? null,
        fellowshipTagId:         state.fellowshipTagId      ?? null,
        fellowshipRelTagName:     this._relTagDraft?.[actor.id]     ?? state.fellowshipRelTagName     ?? "",
        fellowshipRelPartnerName: this._relPartnerDraft?.[actor.id] ?? state.fellowshipRelPartnerName ?? "",
        fellowshipTagName,
        sojourPowerBonus,
        isCamp,
        active,
      };
    });

    return {
      ...context,
      hasScene,
      active,
      isCamp,
      sojourDuration,
      thirdPeriodActive,
      heroes,
      isGM: game.user.isGM,
    };
  }

  /* ─── Actions ────────────────────────────────────────── */

  static async _endCamping() {
    if (!game.user.isGM) return;

    const camping        = LitmCampingScene._getFlags();
    const heroStates     = camping.heroStates ?? {};
    const type           = camping.type ?? "camp";
    const sojourDuration = camping.sojourDuration ?? "days";
    const thirdActive    = camping.thirdPeriodActive ?? false;
    const periodCount    = thirdActive ? 3 : 2;
    const isSojourn      = type === "sojourn";
    const increment      = isSojourn ? 3 : 1;

    const activeIds  = game.settings.get(FLAG_SCOPE, "partyHeroIds");
    const allHeroes  = game.actors.filter(a => a.type === "hero");
    const heroActors = activeIds !== null
      ? allHeroes.filter(a => activeIds.includes(a.id))
      : allHeroes;

    // ── Chat styling helpers ──────────────────────────────
    const chatLabel = (text, color) =>
      `<span style="font-family:'Texturina',serif;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;color:${color};">${text}</span>`;
    const chatEm = (text, color = "#c9bfa8") =>
      `<span style="color:${color};font-style:italic;">${text}</span>`;
    const chatStatus = name =>
      `<span style="background:rgba(90,138,74,0.15);border:1px solid rgba(90,138,74,0.45);border-radius:3px;padding:0 5px 1px;color:#4caf50;font-style:normal;">${name}</span>`;

    const heroSections = [];

    for (const actor of heroActors) {
      const state = heroStates[actor.id];
      const items = [];

      if (state) {
        // Track mutable state locally so multiple rest/reflect periods don't read stale data
        let liveStatuses = foundry.utils.deepClone(actor.system.statuses ?? []);
        let liveThemes   = foundry.utils.deepClone(actor.system.themes   ?? []);
        let statusDirty  = false;
        let themesDirty  = false;

        // ── Backpack expiry ───────────────────────────────
        const expiries = new Set(state.backpackExpiries ?? []);
        if (expiries.size) {
          const expiredNames = (actor.system.backpack ?? [])
            .filter(b => expiries.has(b.id)).map(b => b.name);
          const backpack = (actor.system.backpack ?? []).filter(b => !expiries.has(b.id));
          await actor.update({ "system.backpack": backpack });
          if (expiredNames.length) {
            items.push(`${chatLabel("Expired", "#c04848")} ${expiredNames.map(n => chatEm(n)).join(", ")}`);
          }
        }

        // ── Activities ────────────────────────────────────
        for (const act of (state.activities ?? []).slice(0, periodCount)) {
          if (!act.activity) continue;

          if (act.activity === "rest") {
            const restChoices = act.restChoices ?? {};
            const changes     = [];
            liveStatuses = liveStatuses.map(s => {
              const c      = restChoices[s.id] ?? { action: "", amount: 1 };
              const action = c.action ?? "";
              const amount = Math.max(1, c.amount ?? 1);
              if (action === "remove") {
                changes.push(`<span style="color:#c04848;">removed</span> ${chatStatus(s.name)}`);
                return null;
              }
              if (action === "reduce") {
                s.markedBoxes = (s.markedBoxes ?? []).map(b => b - amount).filter(b => b > 0);
                if (!s.markedBoxes.length) { changes.push(`<span style="color:#c04848;">removed</span> ${chatStatus(s.name)}`); return null; }
                s.tier = s.markedBoxes[s.markedBoxes.length - 1];
                changes.push(`<span style="color:#c9a84c;">reduced</span> ${chatStatus(s.name)} by ${amount}`);
              }
              return s;
            }).filter(Boolean);
            if (changes.length) statusDirty = true;
            items.push(changes.length
              ? `${chatLabel("Rest", "#4caf50")} — ${changes.join(", ")}`
              : chatLabel("Rest", "#4caf50"));

          } else if (act.activity === "reflect") {
            const target = act.reflectTarget;
            let html = chatLabel("Reflect", "#6a9fe8");
            if (target) {
              const [kind, id] = target.split(":");
              if (kind === "theme") {
                const theme = liveThemes.find(t => t.id === id);
                if (theme) {
                  theme.improveCount = Math.min((theme.improveCount ?? 0) + increment, 5);
                  themesDirty = true;
                  html += ` → ${chatEm(theme.name)}`;
                }
              } else if (kind === "fellowship") {
                const fw = game.actors.get(id);
                if (fw) {
                  await fw.update({ "system.improveCount": Math.min((fw.system.improveCount ?? 0) + increment, 3) });
                  html += ` → ${chatEm(`Fellowship: ${fw.name}`)}`;
                }
              }
            }
            items.push(html);

          } else if (act.activity === "campAction") {
            const detail = act.detail?.trim();
            items.push(detail
              ? `${chatLabel("Camp Action", "#c9a84c")} — ${chatEm(detail)}`
              : chatLabel("Camp Action", "#c9a84c"));
          }
        }

        // Flush accumulated status / theme changes
        if (statusDirty) await actor.update({ "system.statuses": liveStatuses });
        if (themesDirty) await actor.update({ "system.themes":   liveThemes   });

        // ── Fellowship ────────────────────────────────────
        const choice = state.fellowshipChoice;
        if (choice === "recover") {
          const tagId      = state.fellowshipTagId;
          const fellowship = actor.system.fellowshipId
            ? game.actors.get(actor.system.fellowshipId) ?? null : null;
          if (tagId && fellowship) {
            const titleTag     = foundry.utils.deepClone(fellowship.system.titleTag ?? {});
            const powerTags    = foundry.utils.deepClone(fellowship.system.powerTags ?? []);
            const weaknessTags = foundry.utils.deepClone(fellowship.system.weaknessTags ?? []);
            let recoveredName  = null;
            if (titleTag.id === tagId) { titleTag.scratched = false; recoveredName = titleTag.name; }
            for (const t of powerTags)    { if (t.id === tagId) { t.scratched = false; recoveredName = t.name; } }
            for (const t of weaknessTags) { if (t.id === tagId) { t.scratched = false; recoveredName = t.name; } }
            if (recoveredName) {
              const update = { "system.powerTags": powerTags, "system.weaknessTags": weaknessTags };
              if (titleTag.id === tagId) update["system.titleTag"] = titleTag;
              await fellowship.update(update);
              items.push(`${chatLabel("Fellowship", "#c9a84c")} — recovered ${chatEm(recoveredName, "#c9a84c")}`);
            }
          }
        } else if (choice === "newRelationship") {
          const tagName     = (state.fellowshipRelTagName     ?? "").trim();
          const partnerName = (state.fellowshipRelPartnerName ?? "").trim();
          if (tagName) {
            const relTags = foundry.utils.deepClone(actor.system.relationshipTags ?? []);
            relTags.push({ id: foundry.utils.randomID(), companionName: partnerName, tag: tagName, scratched: false });
            await actor.update({ "system.relationshipTags": relTags });
            const withStr = partnerName ? ` with ${chatEm(partnerName, "#c9a84c")}` : "";
            items.push(`${chatLabel("Fellowship", "#c9a84c")} — new relationship ${chatEm(tagName, "#c9a84c")}${withStr}`);
          }
        }
      }

      const itemsHtml = items.length
        ? items.map(i => `<div style="font-size:12px;color:#8a7f6a;line-height:1.7;padding-left:8px;">${i}</div>`).join("")
        : `<div style="font-size:12px;color:#8a7f6a;font-style:italic;padding-left:8px;">nothing recorded</div>`;
      heroSections.push(`<div style="margin-bottom:10px;">
        <div style="font-family:'Texturina',serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#c9bfa8;margin-bottom:4px;">${actor.name}</div>
        ${itemsHtml}
      </div>`);
    }

    const fellowship = heroActors.map(a => a.system.fellowshipId ? game.actors.get(a.system.fellowshipId) : null).find(Boolean);
    const speakerAlias = fellowship ? `The ${fellowship.name}` : "The Fellowship";

    const typeLabel = type === "sojourn"
      ? `Sojourn — ${sojourDuration.charAt(0).toUpperCase() + sojourDuration.slice(1)}`
      : "Camp";

    const content = `<div class="litm-camp-card" style="font-family:'Labrada',Georgia,serif;background:#1e1b17;border-radius:4px;padding:10px 12px;margin:-4px;">
      <p style="font-family:'Texturina',serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a7f6a;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #3a3228;">${typeLabel}</p>
      ${heroSections.join("")}
    </div>`;

    await ChatMessage.create({ content, speaker: { alias: speakerAlias } });
    await canvas.scene?.unsetFlag(FLAG_SCOPE, "camping");
    game.socket.emit(`system.${FLAG_SCOPE}`, { type: "campingEnd" });
    LitmCampingScene.instance?.close();
  }

  static async _toggleType() {
    await LitmCampingScene._save(camping => {
      camping.type = (camping.type ?? "camp") === "camp" ? "sojourn" : "camp";
    });
  }

  static async _addThirdActivity() {
    await LitmCampingScene._save(camping => {
      camping.thirdPeriodActive = true;
    });
  }

  static async _removeThirdActivity() {
    await LitmCampingScene._save(camping => {
      camping.thirdPeriodActive = false;
      for (const state of Object.values(camping.heroStates ?? {})) {
        if (state.activities?.[2]) state.activities[2] = { activity: null, detail: "", reflectTarget: null, restChoices: {} };
      }
    });
  }

  static async _setFellowshipChoice(event, target) {
    const { heroId, choice } = target.dataset;
    await LitmCampingScene._save(camping => {
      const state = LitmCampingScene._ensureHeroState(camping, heroId);
      state.fellowshipChoice         = state.fellowshipChoice === choice ? null : choice;
      state.fellowshipTagId          = null;
      state.fellowshipRelTagName     = "";
      state.fellowshipRelPartnerName = "";
    });
  }

  /* ─── Render ─────────────────────────────────────────── */

  // Defer re-renders while a native <select> dropdown is actively open.
  // _selectOpen is set on mousedown and cleared on change/blur so we only
  // block renders between the user clicking a select and completing (or
  // abandoning) their choice — not just because a select has keyboard focus.
  render(...args) {
    if (this.rendered && this._selectOpen) {
      clearTimeout(this._renderDefer);
      this._renderDefer = setTimeout(() => this.render(...args), 150);
      return this;
    }
    clearTimeout(this._renderDefer);
    return super.render(...args);
  }

  async _preRender(context, options) {
    const body = this.element?.querySelector(".cs-body");
    if (body) this._savedScroll = body.scrollTop;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (this._savedScroll !== undefined) {
      const body = this.element?.querySelector(".cs-body");
      if (body) body.scrollTop = this._savedScroll;
      this._savedScroll = undefined;
    }

    // Track whether a native <select> dropdown is currently open.
    // Listeners are on the persistent app element so they survive part re-renders.
    if (!this._selectListenersAttached) {
      this._selectListenersAttached = true;
      this.element.addEventListener("mousedown", ev => {
        if (ev.target.tagName === "SELECT") this._selectOpen = true;
      });
      this.element.addEventListener("change", ev => {
        if (ev.target.tagName === "SELECT") this._selectOpen = false;
      });
      this.element.addEventListener("blur", ev => {
        if (ev.target.tagName === "SELECT") this._selectOpen = false;
      }, true); // blur doesn't bubble, use capture
    }

    // Sojourn duration dropdown
    const durSel = this.element.querySelector(".cs-duration-sel");
    if (durSel) {
      durSel.addEventListener("change", async ev => {
        const val = ev.target.value;
        await LitmCampingScene._save(camping => { camping.sojourDuration = val; });
      });
    }

    // Backpack checkboxes
    for (const cb of this.element.querySelectorAll(".cs-bp-check[data-hero-id]")) {
      cb.addEventListener("change", async ev => {
        const { heroId, itemId } = cb.dataset;
        const checked = ev.target.checked;
        await LitmCampingScene._save(camping => {
          const state    = LitmCampingScene._ensureHeroState(camping, heroId);
          const expiries = state.backpackExpiries ?? [];
          const idx      = expiries.indexOf(itemId);
          if (checked) { if (idx === -1) expiries.push(itemId); }
          else         { if (idx !== -1) expiries.splice(idx, 1); }
          state.backpackExpiries = expiries;
        });
      });
    }

    // Activity dropdowns
    for (const sel of this.element.querySelectorAll(".cs-act-sel[data-hero-id]")) {
      sel.addEventListener("change", async ev => {
        const { heroId, period } = sel.dataset;
        const val = ev.target.value || null;
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          state.activities[Number(period)].activity      = val;
          state.activities[Number(period)].reflectTarget = null;
          state.activities[Number(period)].restChoices   = {};
        });
      });
    }

    // Camp action detail inputs
    for (const inp of this.element.querySelectorAll(".cs-act-detail[data-hero-id]")) {
      inp.addEventListener("change", async ev => {
        const { heroId, period } = inp.dataset;
        const value = ev.target.value;
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          state.activities[Number(period)].detail = value;
        });
      });
    }

    // Reflect target dropdowns
    for (const sel of this.element.querySelectorAll(".cs-act-reflect-sel[data-hero-id]")) {
      sel.addEventListener("change", async ev => {
        const { heroId, period } = sel.dataset;
        const val = ev.target.value || null;
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          state.activities[Number(period)].reflectTarget = val;
        });
      });
    }

    // Rest action dropdowns (per status)
    for (const sel of this.element.querySelectorAll(".cs-rest-action[data-hero-id]")) {
      sel.addEventListener("change", async ev => {
        const { heroId, period, statusId } = sel.dataset;
        const val = ev.target.value;
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          const act   = state.activities[Number(period)];
          if (!act.restChoices) act.restChoices = {};
          const current = act.restChoices[statusId] ?? { action: "", amount: 1 };
          act.restChoices[statusId] = { ...current, action: val };
        });
        // Toggle amount input immediately without waiting for re-render
        const row = sel.closest(".cs-rest-status-row");
        row?.querySelector(".cs-rest-amount")?.classList.toggle("cs-detail-hidden", val !== "reduce");
      });
    }

    // Rest amount inputs
    for (const inp of this.element.querySelectorAll(".cs-rest-amount[data-hero-id]")) {
      inp.addEventListener("change", async ev => {
        const { heroId, period, statusId } = inp.dataset;
        const amount = Math.max(1, parseInt(ev.target.value) || 1);
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          const act   = state.activities[Number(period)];
          if (!act.restChoices) act.restChoices = {};
          const current = act.restChoices[statusId] ?? { action: "reduce", amount: 1 };
          act.restChoices[statusId] = { ...current, amount };
        });
      });
    }

    // Fellowship recover tag dropdown
    for (const sel of this.element.querySelectorAll(".cs-fs-tag-sel[data-hero-id]")) {
      sel.addEventListener("change", async ev => {
        const { heroId } = sel.dataset;
        const val = ev.target.value || null;
        await LitmCampingScene._save(camping => {
          const state = LitmCampingScene._ensureHeroState(camping, heroId);
          state.fellowshipTagId = val;
        });
      });
    }

    // Fellowship relationship inputs (partner name + tag name).
    // `input` keeps a draft cache so re-renders mid-typing don't wipe unsaved text.
    // `change` (blur) commits and clears the draft.
    for (const inp of this.element.querySelectorAll(".cs-fs-rel-partner[data-hero-id]")) {
      const { heroId } = inp.dataset;
      inp.addEventListener("input", ev => {
        (this._relPartnerDraft ??= {})[heroId] = ev.target.value;
      });
      inp.addEventListener("change", async ev => {
        const val = ev.target.value;
        delete (this._relPartnerDraft ??= {})[heroId];
        await LitmCampingScene._save(camping => {
          LitmCampingScene._ensureHeroState(camping, heroId).fellowshipRelPartnerName = val;
        });
      });
    }

    for (const inp of this.element.querySelectorAll(".cs-fs-rel-name[data-hero-id]")) {
      const { heroId } = inp.dataset;
      inp.addEventListener("input", ev => {
        (this._relTagDraft ??= {})[heroId] = ev.target.value;
      });
      inp.addEventListener("change", async ev => {
        const val = ev.target.value;
        delete (this._relTagDraft ??= {})[heroId];
        await LitmCampingScene._save(camping => {
          LitmCampingScene._ensureHeroState(camping, heroId).fellowshipRelTagName = val;
        });
      });
    }
  }
}
