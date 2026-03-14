const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = "legend-in-the-mist-foundry";

export class LitmSceneTracker extends HandlebarsApplicationMixin(ApplicationV2) {

  static instance = null;

  _editMode = false;

  static DEFAULT_OPTIONS = {
    id: "litm-scene-tracker",
    classes: ["litm", "scene-tracker"],
    position: { width: 580, height: 520 },
    window: { resizable: true, title: "Scene Tracker" },
    actions: {
      addStoryTag:             LitmSceneTracker._addStoryTag,
      removeStoryTag:          LitmSceneTracker._removeStoryTag,
      scratchStoryTag:         LitmSceneTracker._scratchStoryTag,
      toggleTagVisibility:     LitmSceneTracker._toggleTagVisibility,
      addStatus:               LitmSceneTracker._addStatus,
      toggleStatusBox:         LitmSceneTracker._toggleStatusBox,
      linkChallenge:           LitmSceneTracker._linkChallenge,
      unlinkChallenge:         LitmSceneTracker._unlinkChallenge,
      toggleChallengeVisibility: LitmSceneTracker._toggleChallengeVisibility,
      toggleChallengeLimitsVisibility: LitmSceneTracker._toggleChallengeLimitsVisibility,
      openChallengeSheet:      LitmSceneTracker._openChallengeSheet,
      toggleEditMode:          LitmSceneTracker._toggleEditMode,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/apps/scene-tracker.hbs",
      scrollY: [".st-left", ".st-right"]
    }
  };

  /* ─── Singleton ─────────────────────────────────────── */

  static open() {
    if (!LitmSceneTracker.instance) {
      LitmSceneTracker.instance = new LitmSceneTracker();
    }
    LitmSceneTracker.instance.render(true);
    return LitmSceneTracker.instance;
  }

  async close(options) {
    LitmSceneTracker.instance = null;
    return super.close(options);
  }

  /* ─── Context ───────────────────────────────────────── */

  async _prepareContext(options) {
    const context   = await super._prepareContext(options);
    const flags     = canvas.scene?.flags?.[FLAG_SCOPE] ?? {};
    const isGM      = game.user.isGM;
    const sceneName = canvas.scene?.name ?? "—";

    const allTags   = flags.storyTags ?? [];
    const storyTags = isGM ? allTags : allTags.filter(t => t.visible !== false);

    const statuses = (flags.statuses ?? []).map(status => {
      const highest = status.markedBoxes?.length
        ? status.markedBoxes[status.markedBoxes.length - 1]
        : null;
      return {
        ...status,
        boxes: Array.from({ length: 6 }, (_, i) => ({
          tier:     i + 1,
          marked:   (status.markedBoxes ?? []).includes(i + 1),
          isActive: i + 1 === highest,
        }))
      };
    });

    const allChallenges = (flags.challengeIds ?? [])
      .map(c => ({ ...c, actor: game.actors.get(c.actorId) ?? null, showLimits: isGM || c.limitsVisible === true }))
      .filter(c => c.actor !== null);
    const challenges = isGM ? allChallenges : allChallenges.filter(c => c.visible !== false);

    return { ...context, isGM, sceneName, storyTags, statuses, challenges };
  }

  /* ─── Flag helpers ──────────────────────────────────── */

  static _getFlags() {
    return foundry.utils.deepClone(canvas.scene?.flags?.[FLAG_SCOPE] ?? {});
  }

  static async _setFlag(key, value) {
    return canvas.scene?.setFlag(FLAG_SCOPE, key, value);
  }

  /* ─── Actions ───────────────────────────────────────── */

  static async _addStoryTag(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const tags  = flags.storyTags ?? [];
    const id    = foundry.utils.randomID();
    tags.push({ id, name: "", scratched: false, visible: true });
    await LitmSceneTracker._setFlag("storyTags", tags);
    if (LitmSceneTracker.instance) LitmSceneTracker.instance._focusStoryTagId = id;
  }

  static async _removeStoryTag(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const tags  = (flags.storyTags ?? []).filter(t => t.id !== target.dataset.id);
    await LitmSceneTracker._setFlag("storyTags", tags);
  }

  static async _toggleTagVisibility(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const tags  = flags.storyTags ?? [];
    const tag   = tags.find(t => t.id === target.dataset.id);
    if (!tag) return;
    tag.visible = tag.visible === false ? true : false;
    await LitmSceneTracker._setFlag("storyTags", tags);
  }

  static async _scratchStoryTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    if (event.target.closest(".st-eye-btn")) return;
    const flags = LitmSceneTracker._getFlags();
    const tags  = flags.storyTags ?? [];
    const tag   = tags.find(t => t.id === target.dataset.id);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    await LitmSceneTracker._setFlag("storyTags", tags);
  }

  static async _addStatus(event, target) {
    const flags    = LitmSceneTracker._getFlags();
    const statuses = flags.statuses ?? [];
    const id       = foundry.utils.randomID();
    statuses.push({ id, name: "", tier: 1, markedBoxes: [] });
    await LitmSceneTracker._setFlag("statuses", statuses);
    if (LitmSceneTracker.instance) LitmSceneTracker.instance._focusStatusId = id;
  }

  static async _toggleStatusBox(event, target) {
    const { statusId, tier } = target.dataset;
    const t      = Number(tier);
    const flags  = LitmSceneTracker._getFlags();
    let statuses = flags.statuses ?? [];
    const idx    = statuses.findIndex(s => s.id === statusId);
    if (idx === -1) return;
    const status = statuses[idx];

    const nameInput = LitmSceneTracker.instance?.element?.querySelector(`.st-sname[data-status-id="${statusId}"]`);
    if (nameInput) status.name = nameInput.value.trim();

    if (status.markedBoxes.includes(t)) {
      status.markedBoxes = status.markedBoxes.filter(b => b !== t);
    } else {
      status.markedBoxes.push(t);
      status.markedBoxes.sort((a, b) => a - b);
    }
    if (status.markedBoxes.length === 0) {
      statuses = statuses.filter(s => s.id !== statusId);
    } else {
      status.tier = status.markedBoxes[status.markedBoxes.length - 1];
    }
    await LitmSceneTracker._setFlag("statuses", statuses);
  }

  static async _linkChallenge(event, target) {
    const flags  = LitmSceneTracker._getFlags();
    const linked = new Set((flags.challengeIds ?? []).map(c => c.actorId));
    const avail  = game.actors.filter(a => a.type === "challenge" && !linked.has(a.id));

    if (!avail.length) {
      ui.notifications.info("All Challenge actors are already linked to this scene.");
      return;
    }

    const optHtml = avail.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    const actorId = await new Promise(resolve => {
      new Dialog({
        title: "Link Challenge",
        content: `<div style="padding:4px 0 8px"><select id="litm-ch-sel" style="width:100%">${optHtml}</select></div>`,
        buttons: {
          ok:     { label: "Link",   callback: html => resolve(html.find("#litm-ch-sel").val()) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        render:  html => { setTimeout(() => html.find("#litm-ch-sel").focus(), 0); },
        close:   () => resolve(null),
      }).render(true);
    });
    if (!actorId) return;

    const ids = flags.challengeIds ?? [];
    ids.push({ id: foundry.utils.randomID(), actorId, visible: true, limitsVisible: false });
    await LitmSceneTracker._setFlag("challengeIds", ids);
  }

  static async _toggleChallengeVisibility(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const ids   = flags.challengeIds ?? [];
    const entry = ids.find(c => c.id === target.dataset.id);
    if (!entry) return;
    entry.visible = entry.visible === false ? true : false;
    await LitmSceneTracker._setFlag("challengeIds", ids);
  }

  static async _toggleChallengeLimitsVisibility(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const ids   = flags.challengeIds ?? [];
    const entry = ids.find(c => c.id === target.dataset.id);
    if (!entry) return;
    entry.limitsVisible = !entry.limitsVisible;
    await LitmSceneTracker._setFlag("challengeIds", ids);
  }

  static async _unlinkChallenge(event, target) {
    const flags = LitmSceneTracker._getFlags();
    const ids   = (flags.challengeIds ?? []).filter(c => c.id !== target.dataset.id);
    await LitmSceneTracker._setFlag("challengeIds", ids);
  }

  static _openChallengeSheet(event, target) {
    game.actors.get(target.dataset.actorId)?.sheet?.render(true);
  }

  static _toggleEditMode(event, target) {
    this._editMode = !this._editMode;
    this.element.querySelector(".litm-scene-tracker")?.classList.toggle("is-editing", this._editMode);
    target.closest(".st-edit-toggle")?.classList.toggle("active", this._editMode);
  }

  /* ─── Render ────────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    // Apply edit mode state
    this.element.querySelector(".litm-scene-tracker")?.classList.toggle("is-editing", this._editMode);
    this.element.querySelector(".st-edit-toggle")?.classList.toggle("active", this._editMode);

    // Story tag inline editing
    for (const input of this.element.querySelectorAll(".st-tag-inp[data-id]")) {
      input.addEventListener("change", async ev => {
        const flags = LitmSceneTracker._getFlags();
        const tags  = flags.storyTags ?? [];
        const tag   = tags.find(t => t.id === ev.target.dataset.id);
        if (!tag) return;
        const name = ev.target.value.trim();
        if (!name) {
          await LitmSceneTracker._setFlag("storyTags", tags.filter(t => t.id !== ev.target.dataset.id));
        } else {
          tag.name = name;
          await LitmSceneTracker._setFlag("storyTags", tags);
        }
      });
    }

    // Focus newly added story tag
    if (this._focusStoryTagId) {
      const id = this._focusStoryTagId;
      this._focusStoryTagId = null;
      this.element.querySelector(`.st-tag-inp[data-id="${id}"]`)?.focus();
    }

    // Focus newly added status
    if (this._focusStatusId) {
      const id = this._focusStatusId;
      this._focusStatusId = null;
      const input = this.element.querySelector(`.st-sname[data-status-id="${id}"]`);
      if (input) {
        input.style.pointerEvents = "auto";
        input.focus();
      }
    }

    // Status name inputs
    for (const input of this.element.querySelectorAll(".st-sname[data-status-id]")) {
      input.addEventListener("change", async ev => {
        const flags    = LitmSceneTracker._getFlags();
        let statuses   = flags.statuses ?? [];
        const status   = statuses.find(s => s.id === ev.target.dataset.statusId);
        if (!status) return;
        const raw = ev.target.value.trim();
        if (!raw) {
          await LitmSceneTracker._setFlag("statuses", statuses.filter(s => s.id !== ev.target.dataset.statusId));
        } else {
          const match = raw.match(/^(.+)-(\d+)$/);
          if (match) {
            const tier = Math.clamp(parseInt(match[2]), 1, 6);
            status.name        = match[1].trim();
            status.tier        = tier;
            status.markedBoxes = [tier];
          } else {
            status.name = raw;
          }
          await LitmSceneTracker._setFlag("statuses", statuses);
        }
      });
    }
  }
}
