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
      addStatus:            ChallengeSheet._addStatus,
      toggleStatusBox:      ChallengeSheet._toggleStatusBox,
      addLimit:             ChallengeSheet._addLimit,
      removeLimit:          ChallengeSheet._removeLimit,
      toggleLimitImmunity:  ChallengeSheet._toggleLimitImmunity,
      toggleLimitProgress:  ChallengeSheet._toggleLimitProgress,
      addThreat:            ChallengeSheet._addThreat,
      removeThreat:         ChallengeSheet._removeThreat,
      addLinkedConsequence: ChallengeSheet._addLinkedConsequence,
      addConsequence:       ChallengeSheet._addConsequence,
      removeConsequence:    ChallengeSheet._removeConsequence,
      addSpecialFeature:    ChallengeSheet._addSpecialFeature,
      removeSpecialFeature: ChallengeSheet._removeSpecialFeature,
      toggleEditMode:       ChallengeSheet._toggleEditMode,
      importChallenge:      ChallengeSheet._importChallenge,
    }
  };

  // _editMode initialized in _onRender from localStorage, defaulting to true

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/challenge-sheet.hbs",
      scrollY: [".chal-left", ".chal-right"]
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
      limits: system.limits.map(limit => ({ ...limit })),
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
      threats: system.threats.map(threat => ({
        ...threat,
        linkedConsequences: system.consequences
          .filter(c => c.linkedThreatId === threat.id)
          .map(c => ({ ...c, renderedDescription: ChallengeSheet._parseInlineRefs(c.description) })),
      })),
      standaloneConsequences: system.consequences
        .filter(c => !c.linkedThreatId || !system.threats.find(t => t.id === c.linkedThreatId))
        .map(c => ({ ...c, renderedDescription: ChallengeSheet._parseInlineRefs(c.description) })),
      specialFeatures: system.specialFeatures.map(f => ({
        ...f,
        renderedDescription: ChallengeSheet._parseInlineRefs(f.description)
      })),
    };
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _setRating(event, target) {
    const value   = Number(target.dataset.value);
    const current = this.actor.system.rating;
    return this.actor.update({ "system.rating": current === value ? 1 : value });
  }

  static async _addTag(event, target) {
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    const id = foundry.utils.randomID();
    tags.push({ id, name: "", scratched: false, singleUse: false });
    this._focusTagId = id;
    return this.actor.update({ "system.tags": tags });
  }

  static async _scratchTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const tags = foundry.utils.deepClone(this.actor.system.tags);
    const tag  = tags.find(t => t.id === target.dataset.tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
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
    const id = foundry.utils.randomID();
    limits.push({ id, name: "", max: 3, current: 0, isImmunity: false, isProgress: false, specialFeature: "" });
    this._focusLimitId = id;
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
    limit.isImmunity = !limit.isImmunity;
    if (limit.isImmunity) limit.max = null;
    else if (limit.max === null) limit.max = 3;
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
    const id = foundry.utils.randomID();
    threats.push({ id, name: "", description: "", consequenceIds: [] });
    this._focusThreatId = id;
    return this.actor.update({ "system.threats": threats });
  }

  static async _removeThreat(event, target) {
    const threats = this.actor.system.threats.filter(t => t.id !== target.dataset.id);
    return this.actor.update({ "system.threats": threats });
  }

  static async _addLinkedConsequence(event, target) {
    const consequences = foundry.utils.deepClone(this.actor.system.consequences);
    const id = foundry.utils.randomID();
    consequences.push({ id, description: "", linkedThreatId: target.dataset.threatId });
    this._focusConsequenceId = id;
    return this.actor.update({ "system.consequences": consequences });
  }

  static async _addConsequence(event, target) {
    const consequences = foundry.utils.deepClone(this.actor.system.consequences);
    const id = foundry.utils.randomID();
    consequences.push({ id, description: "", linkedThreatId: "" });
    this._focusConsequenceId = id;
    return this.actor.update({ "system.consequences": consequences });
  }

  static async _removeConsequence(event, target) {
    const consequences = this.actor.system.consequences.filter(c => c.id !== target.dataset.id);
    return this.actor.update({ "system.consequences": consequences });
  }

  static async _addSpecialFeature(event, target) {
    const features = foundry.utils.deepClone(this.actor.system.specialFeatures);
    features.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.actor.update({ "system.specialFeatures": features });
  }

  static async _removeSpecialFeature(event, target) {
    const features = this.actor.system.specialFeatures.filter(f => f.id !== target.dataset.featureId);
    return this.actor.update({ "system.specialFeatures": features });
  }

  static _importChallenge(event, target) {
    const input = document.createElement("input");
    input.type  = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const json = JSON.parse(await file.text());
        const entries = Array.isArray(json) ? json : [json];
        if (!entries.length || entries.some(e => typeof e !== "object" || Array.isArray(e)))
          throw new Error("JSON must be a challenge object or an array of challenge objects.");

        const id = () => foundry.utils.randomID();

        // Wrap bare status references (e.g. grabbed-3) that aren't already bracketed
        const wrapStatuses = text =>
          (text ?? "").replace(/(?<!\[)([a-z]+(?:-[a-z]+)*-\d+)(?!\])/g, "[$1]");

        const buildActorData = raw => {
          const threats      = [];
          const consequences = [];
          for (const t of (raw.threats ?? [])) {
            const threatId = id();
            threats.push({ id: threatId, name: t.name ?? "", description: wrapStatuses(t.description), consequenceIds: [] });
            for (const desc of (t.consequences ?? [])) {
              consequences.push({ id: id(), description: wrapStatuses(desc), linkedThreatId: threatId });
            }
          }
          return {
            name: raw.name ?? "Imported Challenge",
            type: "challenge",
            system: {
              role:        raw.role        ?? "",
              description: raw.description ?? "",
              rating:      raw.rating      ?? 2,
              tags: (raw.tags ?? []).map(t => ({ id: id(), name: t.name ?? "", scratched: t.scratched ?? false, singleUse: t.singleUse ?? false })),
              statuses: (raw.statuses ?? []).map(s => {
                const tier = Math.min(Math.max(parseInt(s.tier) || 1, 1), 6);
                return { id: id(), name: s.name ?? "", tier, markedBoxes: [tier] };
              }),
              limits: (raw.limits ?? []).map(l => ({
                id:             id(),
                name:           l.name           ?? "",
                max:            l.isImmunity ? null : (l.max ?? 3),
                current:        l.current        ?? 0,
                isImmunity:     l.isImmunity     ?? false,
                isProgress:     l.isProgress     ?? false,
                specialFeature: l.specialFeature ?? "",
              })),
              threats,
              consequences,
              specialFeatures: (raw.specialFeatures ?? []).map(f => ({ id: id(), name: f.name ?? "", description: wrapStatuses(f.description) })),
            }
          };
        };

        const actors = await Actor.createDocuments(entries.map(buildActorData));
        for (const actor of actors) actor.sheet.render(true);
        const label = actors.length === 1 ? `"${actors[0].name}"` : `${actors.length} challenges`;
        ui.notifications.info(`${label} imported.`);
      } catch (e) {
        ui.notifications.error(`Challenge import failed: ${e.message}`);
      }
    };
    input.click();
  }

  static _toggleEditMode(event, target) {
    this._editMode = !this._editMode;
    localStorage.setItem(`litm.editMode.challenge.${this.actor.id}`, this._editMode);
    this.element.querySelector(".litm-challenge-sheet")?.classList.toggle("is-editing", this._editMode);
    target.closest(".chal-edit-toggle")?.classList.toggle("active", this._editMode);
  }

  /* ─── Render ───────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);

    // Apply edit mode state (initialize from localStorage on first render)
    if (!this.hasOwnProperty("_editMode")) {
      const saved = localStorage.getItem(`litm.editMode.challenge.${this.actor.id}`);
      this._editMode = saved !== null ? saved === "true" : true;
    }
    this.element.querySelector(".litm-challenge-sheet")?.classList.toggle("is-editing", this._editMode);
    this.element.querySelector(".chal-edit-toggle")?.classList.toggle("active", this._editMode);

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

    // Limit max inputs
    for (const input of this.element.querySelectorAll(".lim-max-inp[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.actor.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.max = Math.clamp(Number(ev.target.value), 1, 6);
        await this.actor.update({ "system.limits": limits });
      });
    }

    // Limit name inputs
    for (const input of this.element.querySelectorAll(".lim-name[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.actor.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.name = ev.target.value.trim();
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

    // Threat name + description inputs
    for (const input of this.element.querySelectorAll(".tname-input[data-threat-id]")) {
      input.addEventListener("change", async ev => {
        const threats = foundry.utils.deepClone(this.actor.system.threats);
        const threat  = threats.find(t => t.id === ev.target.dataset.threatId);
        if (!threat) return;
        threat.name = ev.target.value.trim();
        await this.actor.update({ "system.threats": threats });
      });
    }

    for (const input of this.element.querySelectorAll(".tdesc-input[data-threat-id]")) {
      input.addEventListener("change", async ev => {
        const threats = foundry.utils.deepClone(this.actor.system.threats);
        const threat  = threats.find(t => t.id === ev.target.dataset.threatId);
        if (!threat) return;
        threat.description = ev.target.value.trim();
        await this.actor.update({ "system.threats": threats });
      });
    }

    // Consequence display/edit toggle
    for (const item of this.element.querySelectorAll(".cblock-item[data-consequence-id], .chal-list-row[data-consequence-id]")) {
      const cid     = item.dataset.consequenceId;
      const display = item.querySelector(".conseq-display");
      const input   = item.querySelector(".conseq-inp");
      if (!display || !input) continue;

      // New empty consequences start in edit mode
      if (!input.value) item.classList.add("editing");

      display.addEventListener("click", () => {
        item.classList.add("editing");
        input.focus();
        input.select();
      });

      input.addEventListener("blur", async ev => {
        const consequences = foundry.utils.deepClone(this.actor.system.consequences);
        const consequence  = consequences.find(c => c.id === cid);
        if (!consequence) return;
        consequence.description = ev.target.value;
        await this.actor.update({ "system.consequences": consequences });
        display.innerHTML = ChallengeSheet._parseInlineRefs(ev.target.value);
        item.classList.remove("editing");
      });
    }

    // Tag inline editing
    for (const input of this.element.querySelectorAll(".ch-tag-inp[data-tag-id]")) {

      input.addEventListener("change", async ev => {
        const tags = foundry.utils.deepClone(this.actor.system.tags);
        const name = ev.target.value.trim();
        if (!name) {
          const newTags = tags.filter(t => t.id !== ev.target.dataset.tagId);
          await this.actor.update({ "system.tags": newTags });
        } else {
          const tag = tags.find(t => t.id === ev.target.dataset.tagId);
          if (!tag) return;
          tag.name = name;
          await this.actor.update({ "system.tags": tags });
        }
      });
    }

    // Focus newly added tag
    if (this._focusTagId) {
      const id = this._focusTagId;
      this._focusTagId = null;
      const input = this.element.querySelector(`.ch-tag-inp[data-tag-id="${id}"]`);
      if (input) { input.style.pointerEvents = "auto"; input.focus(); }
    }

    // Focus newly added limit
    if (this._focusLimitId) {
      const id = this._focusLimitId;
      this._focusLimitId = null;
      const input = this.element.querySelector(`.lim-name[data-limit-id="${id}"]`);
      if (input) { input.style.pointerEvents = "auto"; input.focus(); }
    }

    // Focus newly added threat
    if (this._focusThreatId) {
      const id = this._focusThreatId;
      this._focusThreatId = null;
      const input = this.element.querySelector(`.tname-input[data-threat-id="${id}"]`);
      if (input) { input.style.pointerEvents = "auto"; input.focus(); }
    }

    // Focus newly added consequence
    if (this._focusConsequenceId) {
      const id = this._focusConsequenceId;
      this._focusConsequenceId = null;
      const item = this.element.querySelector(`[data-consequence-id="${id}"]`);
      if (item) {
        item.classList.add("editing");
        const input = item.querySelector(".conseq-inp");
        if (input) { input.style.pointerEvents = "auto"; input.focus(); }
      }
    }

    // Special feature name inputs
    for (const input of this.element.querySelectorAll(".sf-name[data-feature-id]")) {
      input.addEventListener("change", async ev => {
        const features = foundry.utils.deepClone(this.actor.system.specialFeatures);
        const feature  = features.find(f => f.id === ev.target.dataset.featureId);
        if (!feature) return;
        feature.name = ev.target.value.trim();
        await this.actor.update({ "system.specialFeatures": features });
      });
    }

    // Special feature description display/edit toggle
    for (const item of this.element.querySelectorAll(".sf-item")) {
      const fid     = item.querySelector(".sf-desc-inp")?.dataset.featureId;
      const display = item.querySelector(".sf-desc-display");
      const textarea = item.querySelector(".sf-desc-inp");
      if (!display || !textarea || !fid) continue;

      // New empty features start in edit mode
      if (!textarea.value) item.classList.add("sf-editing");

      display.addEventListener("click", () => {
        item.classList.add("sf-editing");
        textarea.focus();
      });

      textarea.addEventListener("blur", async ev => {
        const features = foundry.utils.deepClone(this.actor.system.specialFeatures);
        const feature  = features.find(f => f.id === fid);
        if (!feature) return;
        feature.description = ev.target.value;
        await this.actor.update({ "system.specialFeatures": features });
        display.innerHTML = ChallengeSheet._parseInlineRefs(ev.target.value);
        item.classList.remove("sf-editing");
      });
    }
  }

  /* ─── Utility ─────────────────────────────────────── */

  static _parseInlineRefs(text) {
    if (!text) return "";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // {limit} refs
    let result = escaped.replace(/\{([^}]+)\}/g, (_, inner) =>
      `<span class="inline-limit">${inner}</span>`
    );
    // [status-N] and [tag] refs
    result = result.replace(/\[([^\]]+)\]/g, (_, inner) => {
      const cls = /^.+-\d+$/.test(inner) ? "inline-status" : "inline-tag";
      return `<span class="${cls}">${inner}</span>`;
    });
    return result;
  }

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
