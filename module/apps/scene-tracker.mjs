const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { RollPanel } from "./roll-panel.mjs";

const FLAG_SCOPE = "legend-in-the-mist-foundry";

export class LitmSceneTracker extends HandlebarsApplicationMixin(ApplicationV2) {

  static instance = null;

  _editMode              = false;
  _activeRoll            = null;   // { rollId, actorName } when a player's roll is in progress
  _rollContributions     = new Map(); // contribId → { id, name, kind, tier, source, polarity }
  _rollModeClickHandler  = (ev) => this._onRollModeClick(ev);

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
    // If a roll is already in progress, enter roll mode immediately
    const active = RollPanel.activeInstance;
    if (active?._rollId && !LitmSceneTracker.instance._activeRoll) {
      LitmSceneTracker.instance._onRollStart({ rollId: active._rollId, actorName: active.actor.name, skipRender: true });
    }
    LitmSceneTracker.instance.render(true);
    return LitmSceneTracker.instance;
  }

  async close(options) {
    this._activeRoll = null;
    this._rollContributions.clear();
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

    const activeRoll = (isGM && this._activeRoll) ? this._activeRoll : null;

    return { ...context, isGM, sceneName, storyTags, statuses, challenges, activeRoll };
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
    if (LitmSceneTracker.instance?._activeRoll) return;
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

  /* ─── Roll Mode ─────────────────────────────────────── */

  _onRollStart({ rollId, actorName, skipRender = false } = {}) {
    if (!game.user.isGM) return;
    this._activeRoll = { rollId, actorName };
    this._rollContributions.clear();
    if (!skipRender) this.render();
  }

  _onRollEnd({ rollId }) {
    if (!this._activeRoll || this._activeRoll.rollId !== rollId) return;
    this._activeRoll = null;
    this._rollContributions.clear();
    this.render();
  }

  _emitContributions() {
    if (!this._activeRoll) return;
    const data = {
      type: "gmContributions",
      rollId: this._activeRoll.rollId,
      contributions: Array.from(this._rollContributions.values()),
    };
    game.socket.emit("system.litm", data);
    // socket.emit doesn't loop back to sender — notify local roll panel directly
    RollPanel.activeInstance?._onGmContributions(data);
  }

  _applyContributionClasses() {
    if (!this.element) return;
    for (const el of this.element.querySelectorAll(".st-contrib-neg, .st-contrib-pos")) {
      el.classList.remove("st-contrib-neg", "st-contrib-pos");
    }
    for (const [contribId, contrib] of this._rollContributions) {
      const el = this.element.querySelector(`[data-contrib-id="${contribId}"]`);
      if (!el) continue;
      el.classList.add(contrib.polarity === "positive" ? "st-contrib-pos" : "st-contrib-neg");
    }
  }

  _onRollModeClick(event) {
    if (!this._activeRoll || !game.user.isGM) return;
    const target = event.target.closest("[data-contrib-id]");
    if (!target) return;

    event.stopPropagation();
    event.preventDefault();

    const { contribId, contribName, contribKind, contribTier, contribSource } = target.dataset;
    const tier = contribTier ? Number(contribTier) : null;

    const current = this._rollContributions.get(contribId);
    if (!current) {
      this._rollContributions.set(contribId, {
        id: contribId, name: contribName, kind: contribKind, tier, source: contribSource, polarity: "negative",
      });
    } else if (current.polarity === "negative") {
      current.polarity = "positive";
    } else {
      this._rollContributions.delete(contribId);
    }

    this._applyContributionClasses();
    this._emitContributions();
  }

  /* ─── Drop ─────────────────────────────────────────── */

  async _onDropChallenge(event) {
    event.preventDefault();
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return; }
    if (data.type !== "Actor") return;

    const actor = await fromUuid(data.uuid);
    if (!actor || actor.type !== "challenge") {
      ui.notifications.warn("Only Challenge actors can be dropped here.");
      return;
    }

    const flags  = LitmSceneTracker._getFlags();
    const linked = new Set((flags.challengeIds ?? []).map(c => c.actorId));
    if (linked.has(actor.id)) {
      ui.notifications.info(`${actor.name} is already linked to this scene.`);
      return;
    }

    const ids = flags.challengeIds ?? [];
    ids.push({ id: foundry.utils.randomID(), actorId: actor.id, visible: true, limitsVisible: false });
    await LitmSceneTracker._setFlag("challengeIds", ids);
  }

  /* ─── Render ────────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    // Drop zone for challenge actors
    const stRight = this.element.querySelector(".st-right");
    if (stRight) {
      stRight.addEventListener("dragover", ev => { ev.preventDefault(); stRight.classList.add("drop-hover"); });
      stRight.addEventListener("dragleave", ev => { if (!stRight.contains(ev.relatedTarget)) stRight.classList.remove("drop-hover"); });
      stRight.addEventListener("drop", ev => { stRight.classList.remove("drop-hover"); this._onDropChallenge(ev); });
    }

    // Apply edit mode state
    this.element.querySelector(".litm-scene-tracker")?.classList.toggle("is-editing", this._editMode);
    this.element.querySelector(".st-edit-toggle")?.classList.toggle("active", this._editMode);

    // Apply roll mode state
    const inRollMode = game.user.isGM && !!this._activeRoll;
    this.element.querySelector(".litm-scene-tracker")?.classList.toggle("roll-mode", inRollMode);
    // Use stored handler reference so addEventListener deduplicates across re-renders
    this.element.addEventListener("click", this._rollModeClickHandler, { capture: true });
    if (inRollMode) this._applyContributionClasses();

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
