const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class ChallengeSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "actor", "challenge"],
    position: { width: 780, height: 600 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      setRating:            ChallengeSheet._setRating,
      addTag:               ChallengeSheet._addTag,
      scratchTag:           ChallengeSheet._scratchTag,
      removeTag:            ChallengeSheet._removeTag,
      addStatus:            ChallengeSheet._addStatus,
      toggleStatusBox:      ChallengeSheet._toggleStatusBox,
      addLimit:             ChallengeSheet._addLimit,
      removeLimit:          ChallengeSheet._removeLimit,
      toggleLimitImmunity:  ChallengeSheet._toggleLimitImmunity,
      toggleLimitProgress:  ChallengeSheet._toggleLimitProgress,
      addThreat:            ChallengeSheet._addThreat,
      removeThreat:         ChallengeSheet._removeThreat,
      addConsequence:       ChallengeSheet._addConsequence,
      removeConsequence:    ChallengeSheet._removeConsequence,
      addSpecialFeature:    ChallengeSheet._addSpecialFeature,
      removeSpecialFeature: ChallengeSheet._removeSpecialFeature,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/challenge-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.actor.system;

    return {
      ...context,
      actor:  this.actor,
      system,
      isGM:   game.user.isGM,
      ratingDots: Array.from({ length: 5 }, (_, i) => ({
        value:  i + 1,
        filled: i < system.rating,
      })),
      limits: system.limits.map(limit => ({
        ...limit,
        isImmune: limit.maximum === null,
        maxDots: Array.from({ length: 6 }, (_, i) => ({
          value:  i + 1,
          filled: limit.maximum !== null && i < limit.maximum,
        })),
      })),
      statuses: system.statuses.map((status, idx) => {
        const highest = status.markedBoxes.length
          ? status.markedBoxes[status.markedBoxes.length - 1]
          : null;
        return {
          ...status,
          statusIndex: idx,
          boxes: Array.from({ length: 6 }, (_, i) => ({
            tier:     i + 1,
            marked:   status.markedBoxes.includes(i + 1),
            isActive: i + 1 === highest,
          }))
        };
      }),
    };
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _setRating(event, target) {
    const value   = Number(target.dataset.value);
    const current = this.actor.system.rating;
    return this.actor.update({ "system.rating": current === value ? 1 : value });
  }

  static async _addTag(event, target) {
    const name = await ChallengeSheet._prompt("New tag:");
    if (!name) return;
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    tags.push({ id: foundry.utils.randomID(), name, scratched: false, singleUse: false });
    return this.actor.update({ "system.tags": tags });
  }

  static async _scratchTag(event, target) {
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    const tag  = tags.find(t => t.id === target.dataset.tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.actor.update({ "system.tags": tags });
  }

  static async _removeTag(event, target) {
    const tags = this.actor.system.tags.filter(t => t.id !== target.dataset.tagId);
    return this.actor.update({ "system.tags": tags });
  }

  static async _addStatus(event, target) {
    const statuses = foundry.utils.deepClone(this.actor.system.statuses);
    statuses.push({ id: foundry.utils.randomID(), name: "", tier: 1, markedBoxes: [] });
    return this.actor.update({ "system.statuses": statuses });
  }

  static async _toggleStatusBox(event, target) {
    const { statusId, tier } = target.dataset;
    const t = Number(tier);
    let statuses = foundry.utils.deepClone(this.actor.system.statuses);
    const statusIdx = statuses.findIndex(s => s.id === statusId);
    if (statusIdx === -1) return;
    const status = statuses[statusIdx];

    const nameInput = this.element.querySelector(`.sname[data-status-index="${statusIdx}"]`);
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
    return this.actor.update({ "system.statuses": statuses });
  }

  static async _addLimit(event, target) {
    const limits = foundry.utils.deepClone(this.actor.system.limits);
    limits.push({ id: foundry.utils.randomID(), statusType: "", maximum: 3, isProgress: false, specialFeature: "" });
    return this.actor.update({ "system.limits": limits });
  }

  static async _removeLimit(event, target) {
    const limits = this.actor.system.limits.filter(l => l.id !== target.dataset.limitId);
    return this.actor.update({ "system.limits": limits });
  }

  static async _toggleLimitImmunity(event, target) {
    const limits = foundry.utils.deepClone(this.actor.system.limits);
    const limit  = limits.find(l => l.id === target.dataset.limitId);
    if (!limit) return;
    limit.maximum = limit.maximum === null ? 3 : null;
    return this.actor.update({ "system.limits": limits });
  }

  static async _toggleLimitProgress(event, target) {
    const limits = foundry.utils.deepClone(this.actor.system.limits);
    const limit  = limits.find(l => l.id === target.dataset.limitId);
    if (!limit) return;
    limit.isProgress = !limit.isProgress;
    return this.actor.update({ "system.limits": limits });
  }

  static async _addThreat(event, target) {
    const threats = foundry.utils.deepClone(this.actor.system.threats);
    threats.push("");
    return this.actor.update({ "system.threats": threats });
  }

  static async _removeThreat(event, target) {
    const threats = foundry.utils.deepClone(this.actor.system.threats);
    threats.splice(Number(target.dataset.index), 1);
    return this.actor.update({ "system.threats": threats });
  }

  static async _addConsequence(event, target) {
    const consequences = foundry.utils.deepClone(this.actor.system.consequences);
    consequences.push("");
    return this.actor.update({ "system.consequences": consequences });
  }

  static async _removeConsequence(event, target) {
    const consequences = foundry.utils.deepClone(this.actor.system.consequences);
    consequences.splice(Number(target.dataset.index), 1);
    return this.actor.update({ "system.consequences": consequences });
  }

  static async _addSpecialFeature(event, target) {
    const features = foundry.utils.deepClone(this.actor.system.specialFeatures);
    features.push({ id: foundry.utils.randomID(), condition: "", effect: "" });
    return this.actor.update({ "system.specialFeatures": features });
  }

  static async _removeSpecialFeature(event, target) {
    const features = this.actor.system.specialFeatures.filter(f => f.id !== target.dataset.featureId);
    return this.actor.update({ "system.specialFeatures": features });
  }

  /* ─── Render ───────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    // Status name inputs
    for (const input of this.element.querySelectorAll(".sname")) {
      input.addEventListener("change", ev => {
        const idx      = Number(ev.target.dataset.statusIndex);
        const statuses = foundry.utils.deepClone(this.actor.system.statuses);
        if (!statuses[idx]) return;
        const raw = ev.target.value.trim();
        if (!raw) {
          statuses.splice(idx, 1);
        } else {
          const match = raw.match(/^(.+)-(\d+)$/);
          if (match) {
            const tier = Math.clamp(parseInt(match[2]), 1, 6);
            statuses[idx].name = match[1].trim();
            statuses[idx].tier = tier;
            statuses[idx].markedBoxes = [tier];
          } else {
            statuses[idx].name = raw;
          }
        }
        this.actor.update({ "system.statuses": statuses });
      });
    }

    // Limit max dots
    for (const dot of this.element.querySelectorAll(".lim-dot[data-limit-id]")) {
      dot.addEventListener("click", async () => {
        const limits = foundry.utils.deepClone(this.actor.system.limits);
        const limit  = limits.find(l => l.id === dot.dataset.limitId);
        if (!limit) return;
        const val = Number(dot.dataset.value);
        limit.maximum = limit.maximum === val ? val - 1 || 1 : val;
        await this.actor.update({ "system.limits": limits });
      });
    }

    // Limit status type inputs
    for (const input of this.element.querySelectorAll(".lim-type[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.actor.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.statusType = ev.target.value.trim();
        await this.actor.update({ "system.limits": limits });
      });
    }

    // Limit special feature inputs
    for (const input of this.element.querySelectorAll(".lim-sf[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.actor.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.specialFeature = ev.target.value.trim();
        await this.actor.update({ "system.limits": limits });
      });
    }

    // Threat textarea inputs
    for (const input of this.element.querySelectorAll(".threat-inp[data-index]")) {
      input.addEventListener("change", async ev => {
        const threats = foundry.utils.deepClone(this.actor.system.threats);
        threats[Number(ev.target.dataset.index)] = ev.target.value;
        await this.actor.update({ "system.threats": threats });
      });
    }

    // Consequence textarea inputs
    for (const input of this.element.querySelectorAll(".conseq-inp[data-index]")) {
      input.addEventListener("change", async ev => {
        const consequences = foundry.utils.deepClone(this.actor.system.consequences);
        consequences[Number(ev.target.dataset.index)] = ev.target.value;
        await this.actor.update({ "system.consequences": consequences });
      });
    }

    // Special feature inputs
    for (const input of this.element.querySelectorAll(".sf-condition[data-feature-id], .sf-effect[data-feature-id]")) {
      input.addEventListener("change", async ev => {
        const features = foundry.utils.deepClone(this.actor.system.specialFeatures);
        const feature  = features.find(f => f.id === ev.target.dataset.featureId);
        if (!feature) return;
        feature[ev.target.classList.contains("sf-condition") ? "condition" : "effect"] = ev.target.value.trim();
        await this.actor.update({ "system.specialFeatures": features });
      });
    }
  }

  /* ─── Utility ─────────────────────────────────────── */

  static _prompt(label, defaultValue = "") {
    return new Promise(resolve => {
      new Dialog({
        title: label,
        content: `<div style="padding:4px 0 8px"><input id="litm-prompt" type="text" value="${defaultValue}" style="width:100%"></div>`,
        buttons: {
          ok:     { label: "OK",     callback: html => resolve(html.find("#litm-prompt").val().trim() || null) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        render:  html => { setTimeout(() => html.find("#litm-prompt").focus().select(), 0); },
        close:   () => resolve(null),
      }).render(true);
    });
  }
}
