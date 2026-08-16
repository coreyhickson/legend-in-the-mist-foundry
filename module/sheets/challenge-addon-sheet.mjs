import { parseInlineRefs, syncUnsavedInputs } from "../utils.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const ROLE_OPTIONS = ["Aggressor", "Pursuer", "Charge", "Countdown", "Influence", "Mystery", "Obstacle", "Quarry", "Sapper", "Support", "Watcher"];

export class ChallengeAddonSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "item", "challenge-addon"],
    position: { width: 640, height: 700 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      adjustRating:         ChallengeAddonSheet._adjustRating,
      removeRole:           ChallengeAddonSheet._removeRole,
      addTag:               ChallengeAddonSheet._addTag,
      addStatus:            ChallengeAddonSheet._addStatus,
      toggleStatusBox:      ChallengeAddonSheet._toggleStatusBox,
      addLimit:             ChallengeAddonSheet._addLimit,
      removeLimit:          ChallengeAddonSheet._removeLimit,
      toggleLimitImmunity:  ChallengeAddonSheet._toggleLimitImmunity,
      toggleLimitProgress:  ChallengeAddonSheet._toggleLimitProgress,
      addThreat:            ChallengeAddonSheet._addThreat,
      removeThreat:         ChallengeAddonSheet._removeThreat,
      addLinkedConsequence: ChallengeAddonSheet._addLinkedConsequence,
      addConsequence:       ChallengeAddonSheet._addConsequence,
      removeConsequence:    ChallengeAddonSheet._removeConsequence,
      addSpecialFeature:    ChallengeAddonSheet._addSpecialFeature,
      removeSpecialFeature: ChallengeAddonSheet._removeSpecialFeature,
      addSecret:            ChallengeAddonSheet._addSecret,
      removeSecret:         ChallengeAddonSheet._removeSecret,
      toggleEditMode:       ChallengeAddonSheet._toggleEditMode,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/challenge-addon-sheet.hbs",
      scrollY: [".its-body"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system  = this.item.system;

    return {
      ...context,
      item:   this.item,
      system,
      roleOptions: ROLE_OPTIONS,
      renderedDescription: parseInlineRefs(system.description),
      ratingIncreaseLabel: (system.ratingIncrease >= 0 ? "+" : "") + system.ratingIncrease,
      threatsEmpty: !system.threats.length && !system.consequences.length,
      statuses: system.statuses.map((status, idx) => {
        const highest = status.markedBoxes.length ? status.markedBoxes[status.markedBoxes.length - 1] : null;
        return {
          ...status,
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
          .map(c => ({ ...c, renderedDescription: parseInlineRefs(c.description) })),
      })),
      standaloneConsequences: system.consequences
        .filter(c => !c.linkedThreatId || !system.threats.find(t => t.id === c.linkedThreatId))
        .map(c => ({ ...c, renderedDescription: parseInlineRefs(c.description) })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    const root    = el.querySelector(".litm-challenge-addon-sheet");
    const editBtn = el.querySelector(".caddon-edit-toggle");
    if (!this.hasOwnProperty("_editMode")) this._editMode = false;
    root?.classList.toggle("is-editing", this._editMode);
    editBtn?.classList.toggle("active", this._editMode);

    // Description display/edit toggle (bracket-format aware)
    const descWrap = el.querySelector(".caddon-desc-item");
    if (descWrap) {
      const display  = descWrap.querySelector(".caddon-desc-display");
      const textarea = descWrap.querySelector(".caddon-desc-inp");
      if (display && textarea) {
        if (!textarea.value) descWrap.classList.add("caddon-desc-editing");

        display.addEventListener("click", () => {
          descWrap.classList.add("caddon-desc-editing");
          textarea.focus();
        });

        textarea.addEventListener("blur", async ev => {
          await this.item.update({ "system.description": ev.target.value }, { render: false });
          display.innerHTML = parseInlineRefs(ev.target.value);
          descWrap.classList.remove("caddon-desc-editing");
        });
      }
    }

    // Role dropdown — selecting an option adds that role (if not already present)
    el.querySelector(".role-select")?.addEventListener("change", async ev => {
      const value = ev.target.value;
      ev.target.value = "";
      if (!value) return;
      const roles = foundry.utils.deepClone(this.item.system.roles);
      if (roles.includes(value)) return;
      roles.push(value);
      await this.item.update({ "system.roles": roles });
    });

    // Tag inline editing
    for (const input of el.querySelectorAll(".ch-tag-inp[data-tag-id]")) {
      input.addEventListener("change", async ev => {
        const tags = foundry.utils.deepClone(this.item.system.tags);
        const name = ev.target.value.trim();
        if (!name) {
          await this.item.update({ "system.tags": tags.filter(t => t.id !== ev.target.dataset.tagId) });
        } else {
          const tag = tags.find(t => t.id === ev.target.dataset.tagId);
          if (!tag) return;
          tag.name = name;
          await this.item.update({ "system.tags": tags }, { render: false });
        }
      });
    }

    // Status name inputs — same "name-N" parse convention as the Challenge sheet
    for (const input of el.querySelectorAll(".sname[data-status-index]")) {
      input.addEventListener("change", ev => {
        const idx      = Number(ev.target.dataset.statusIndex);
        const statuses = foundry.utils.deepClone(this.item.system.statuses);
        if (!statuses[idx]) return;
        const raw = ev.target.value.trim();
        if (!raw) {
          statuses.splice(idx, 1);
          this.item.update({ "system.statuses": statuses });
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
          this.item.update({ "system.statuses": statuses });
        }
      });
    }

    // Limit name / max inputs
    for (const input of el.querySelectorAll(".lim-name[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.item.system.limits);
        const name   = ev.target.value.trim();
        if (name) {
          const limit = limits.find(l => l.id === ev.target.dataset.limitId);
          if (!limit) return;
          limit.name = name;
          await this.item.update({ "system.limits": limits }, { render: false });
        } else {
          await this.item.update({ "system.limits": limits.filter(l => l.id !== ev.target.dataset.limitId) });
        }
      });
    }

    for (const input of el.querySelectorAll(".lim-max-inp[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.item.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.max = Math.clamp(Number(ev.target.value), 1, 6);
        await this.item.update({ "system.limits": limits }, { render: false });
      });
    }

    for (const input of el.querySelectorAll(".lim-sf[data-limit-id]")) {
      input.addEventListener("change", async ev => {
        const limits = foundry.utils.deepClone(this.item.system.limits);
        const limit  = limits.find(l => l.id === ev.target.dataset.limitId);
        if (!limit) return;
        limit.specialFeature = ev.target.value.trim();
        await this.item.update({ "system.limits": limits }, { render: false });
      });
    }

    // Threat name + description inputs
    for (const input of el.querySelectorAll(".tname-input[data-threat-id]")) {
      input.addEventListener("change", async ev => {
        const threats = foundry.utils.deepClone(this.item.system.threats);
        const threat  = threats.find(t => t.id === ev.target.dataset.threatId);
        if (!threat) return;
        threat.name = ev.target.value.trim();
        await this.item.update({ "system.threats": threats }, { render: false });
      });
    }

    for (const input of el.querySelectorAll(".tdesc-input[data-threat-id]")) {
      input.addEventListener("change", async ev => {
        const threats = foundry.utils.deepClone(this.item.system.threats);
        const threat  = threats.find(t => t.id === ev.target.dataset.threatId);
        if (!threat) return;
        threat.description = ev.target.value.trim();
        await this.item.update({ "system.threats": threats }, { render: false });
      });
    }

    // Consequence display/edit toggle
    for (const item of el.querySelectorAll(".cblock-item[data-consequence-id], .chal-list-row[data-consequence-id]")) {
      const cid     = item.dataset.consequenceId;
      const display = item.querySelector(".conseq-display");
      const input   = item.querySelector(".conseq-inp");
      if (!display || !input) continue;

      if (!input.value) item.classList.add("editing");

      display.addEventListener("click", () => {
        item.classList.add("editing");
        input.focus();
        input.select();
      });

      input.addEventListener("blur", async ev => {
        const consequences = foundry.utils.deepClone(this.item.system.consequences);
        const consequence  = consequences.find(c => c.id === cid);
        if (!consequence) return;
        consequence.description = ev.target.value;
        await this.item.update({ "system.consequences": consequences }, { render: false });
        display.innerHTML = parseInlineRefs(ev.target.value);
        item.classList.remove("editing");
      });
    }

    // Special feature / secret name inputs
    for (const input of el.querySelectorAll(".si-name[data-feature-id]")) {
      input.addEventListener("change", async ev => {
        const features = foundry.utils.deepClone(this.item.system.specialFeatures);
        const feature  = features.find(f => f.id === ev.target.dataset.featureId);
        if (!feature) return;
        feature.name = ev.target.value.trim();
        await this.item.update({ "system.specialFeatures": features }, { render: false });
      });
    }

    for (const input of el.querySelectorAll(".si-desc[data-feature-id]")) {
      input.addEventListener("change", async ev => {
        const features = foundry.utils.deepClone(this.item.system.specialFeatures);
        const feature  = features.find(f => f.id === ev.target.dataset.featureId);
        if (!feature) return;
        feature.description = ev.target.value.trim();
        await this.item.update({ "system.specialFeatures": features }, { render: false });
      });
    }

    for (const input of el.querySelectorAll(".si-name[data-secret-id]")) {
      input.addEventListener("change", async ev => {
        const secrets = foundry.utils.deepClone(this.item.system.secrets);
        const secret  = secrets.find(s => s.id === ev.target.dataset.secretId);
        if (!secret) return;
        secret.name = ev.target.value.trim();
        await this.item.update({ "system.secrets": secrets }, { render: false });
      });
    }

    for (const input of el.querySelectorAll(".si-desc[data-secret-id]")) {
      input.addEventListener("change", async ev => {
        const secrets = foundry.utils.deepClone(this.item.system.secrets);
        const secret  = secrets.find(s => s.id === ev.target.dataset.secretId);
        if (!secret) return;
        secret.description = ev.target.value.trim();
        await this.item.update({ "system.secrets": secrets }, { render: false });
      });
    }
  }

  /* ─── Actions: Rating ────────────────────────────────── */

  static async _adjustRating(event, target) {
    const delta = Number(target.dataset.delta);
    const next  = Math.clamp(this.item.system.ratingIncrease + delta, -3, 5);
    return this.item.update({ "system.ratingIncrease": next });
  }

  /* ─── Actions: Roles ─────────────────────────────────── */

  static async _removeRole(event, target) {
    const roles = this.item.system.roles.filter((_, i) => i !== Number(target.dataset.index));
    return this.item.update({ "system.roles": roles });
  }

  /* ─── Actions: Tags ──────────────────────────────────── */

  static async _addTag() {
    const tags = foundry.utils.deepClone(this.item.system.tags);
    syncUnsavedInputs(this.element, tags, "tag-id", [
      { selector: ".ch-tag-inp", prop: "name" },
    ]);
    tags.push({ id: foundry.utils.randomID(), name: "", scratched: false, singleUse: false });
    return this.item.update({ "system.tags": tags });
  }

  /* ─── Actions: Statuses ──────────────────────────────── */

  static async _addStatus() {
    const statuses = foundry.utils.deepClone(this.item.system.statuses);

    // Status names are keyed by row index, not id — capture any unsaved edits
    // before appending, the same way _toggleStatusBox does for a single row.
    statuses.forEach((status, idx) => {
      const nameInput = this.element.querySelector(`.sname[data-status-index="${idx}"]`);
      if (nameInput) status.name = nameInput.value.trim();
    });

    statuses.push({ id: foundry.utils.randomID(), name: "", tier: 1, markedBoxes: [] });
    return this.item.update({ "system.statuses": statuses });
  }

  static async _toggleStatusBox(event, target) {
    const { statusId, tier } = target.dataset;
    const t = Number(tier);
    const statuses = foundry.utils.deepClone(this.item.system.statuses);
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
    if (status.markedBoxes.length) status.tier = status.markedBoxes[status.markedBoxes.length - 1];
    return this.item.update({ "system.statuses": statuses });
  }

  /* ─── Actions: Limits ────────────────────────────────── */

  static async _addLimit() {
    const limits = foundry.utils.deepClone(this.item.system.limits);
    syncUnsavedInputs(this.element, limits, "limit-id", [
      { selector: ".lim-name", prop: "name" },
      { selector: ".lim-max-inp", prop: "max", parse: v => Math.clamp(Number(v), 1, 6) },
      { selector: ".lim-sf", prop: "specialFeature" },
    ]);
    limits.push({ id: foundry.utils.randomID(), name: "", max: 3, current: 0, isImmunity: false, isProgress: false, specialFeature: "" });
    return this.item.update({ "system.limits": limits });
  }

  static async _removeLimit(event, target) {
    const limits = this.item.system.limits.filter(l => l.id !== target.dataset.limitId);
    return this.item.update({ "system.limits": limits });
  }

  static async _toggleLimitImmunity(event, target) {
    const limits = foundry.utils.deepClone(this.item.system.limits);
    const limit  = limits.find(l => l.id === target.dataset.limitId);
    if (!limit) return;
    limit.isImmunity = !limit.isImmunity;
    if (limit.isImmunity) limit.max = null;
    else if (limit.max === null) limit.max = 3;
    return this.item.update({ "system.limits": limits });
  }

  static async _toggleLimitProgress(event, target) {
    const limits = foundry.utils.deepClone(this.item.system.limits);
    const limit  = limits.find(l => l.id === target.dataset.limitId);
    if (!limit) return;
    limit.isProgress = !limit.isProgress;
    return this.item.update({ "system.limits": limits });
  }

  /* ─── Actions: Threats & Consequences ────────────────── */

  static async _addThreat() {
    const threats = foundry.utils.deepClone(this.item.system.threats);
    syncUnsavedInputs(this.element, threats, "threat-id", [
      { selector: ".tname-input", prop: "name" },
      { selector: ".tdesc-input", prop: "description" },
    ]);
    threats.push({ id: foundry.utils.randomID(), name: "", description: "", consequenceIds: [] });
    return this.item.update({ "system.threats": threats });
  }

  static async _removeThreat(event, target) {
    const threats = this.item.system.threats.filter(t => t.id !== target.dataset.id);
    return this.item.update({ "system.threats": threats });
  }

  static async _addLinkedConsequence(event, target) {
    const consequences = foundry.utils.deepClone(this.item.system.consequences);
    syncUnsavedInputs(this.element, consequences, "consequence-id", [
      { selector: ".conseq-inp", prop: "description", parse: v => v },
    ]);
    consequences.push({ id: foundry.utils.randomID(), description: "", linkedThreatId: target.dataset.threatId });
    return this.item.update({ "system.consequences": consequences });
  }

  static async _addConsequence() {
    const consequences = foundry.utils.deepClone(this.item.system.consequences);
    syncUnsavedInputs(this.element, consequences, "consequence-id", [
      { selector: ".conseq-inp", prop: "description", parse: v => v },
    ]);
    consequences.push({ id: foundry.utils.randomID(), description: "", linkedThreatId: "" });
    return this.item.update({ "system.consequences": consequences });
  }

  static async _removeConsequence(event, target) {
    const consequences = this.item.system.consequences.filter(c => c.id !== target.dataset.id);
    return this.item.update({ "system.consequences": consequences });
  }

  /* ─── Actions: Special Features & Secrets ────────────── */

  static async _addSpecialFeature() {
    const features = foundry.utils.deepClone(this.item.system.specialFeatures);
    syncUnsavedInputs(this.element, features, "feature-id", [
      { selector: ".si-name", prop: "name" },
      { selector: ".si-desc", prop: "description" },
    ]);
    features.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.item.update({ "system.specialFeatures": features });
  }

  static async _removeSpecialFeature(event, target) {
    const features = this.item.system.specialFeatures.filter(f => f.id !== target.dataset.featureId);
    return this.item.update({ "system.specialFeatures": features });
  }

  static async _addSecret() {
    const secrets = foundry.utils.deepClone(this.item.system.secrets);
    syncUnsavedInputs(this.element, secrets, "secret-id", [
      { selector: ".si-name", prop: "name" },
      { selector: ".si-desc", prop: "description" },
    ]);
    secrets.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.item.update({ "system.secrets": secrets });
  }

  static async _removeSecret(event, target) {
    const secrets = this.item.system.secrets.filter(s => s.id !== target.dataset.secretId);
    return this.item.update({ "system.secrets": secrets });
  }

  /* ─── Edit mode ──────────────────────────────────────── */

  static _toggleEditMode(event, target) {
    this._editMode = !this._editMode;
    this.element.querySelector(".litm-challenge-addon-sheet")?.classList.toggle("is-editing", this._editMode);
    target.closest(".caddon-edit-toggle")?.classList.toggle("active", this._editMode);
  }
}
