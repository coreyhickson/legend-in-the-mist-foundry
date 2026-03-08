const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class HeroSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["litm", "actor", "hero"],
    position: { width: 1050, height: 740 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      roll:                     HeroSheet._roll,
      scratchTag:               HeroSheet._scratchTag,
      addTag:                   HeroSheet._addTag,
      removeTag:                HeroSheet._removeTag,
      setMight:                 HeroSheet._setMight,
      setTrack:                 HeroSheet._setTrack,
      addStatus:                HeroSheet._addStatus,
      toggleStatusBox:          HeroSheet._toggleStatusBox,
      addBackpackItem:          HeroSheet._addBackpackItem,
      scratchBackpackItem:      HeroSheet._scratchBackpackItem,
      removeBackpackItem:       HeroSheet._removeBackpackItem,
      addRelationship:          HeroSheet._addRelationship,
      removeRelationship:       HeroSheet._removeRelationship,
      addQuintessence:          HeroSheet._addQuintessence,
      removeQuintessence:       HeroSheet._removeQuintessence,
      addSpecialImprovement:    HeroSheet._addSpecialImprovement,
      removeSpecialImprovement: HeroSheet._removeSpecialImprovement,
      setPromise:               HeroSheet._setPromise,
      scratchFellowshipTag:     HeroSheet._scratchFellowshipTag,
      editImage:                HeroSheet._editImage,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/hero-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    const fellowship = system.fellowshipId
      ? game.actors.get(system.fellowshipId)
      : null;

    return {
      ...context,
      actor: this.actor,
      system,
      themes: system.themes.map((theme, ti) => ({
        ...theme,
        themeIndex: ti,
        abandonDots:   this._buildDots(theme.abandonCount, 3),
        improveDots:   this._buildDots(theme.improveCount, 3),
        milestoneDots: this._buildDots(theme.milestoneCount, 3),
      })),
      statuses: system.statuses.map(status => {
        const highest = status.markedBoxes.length
          ? status.markedBoxes[status.markedBoxes.length - 1]
          : null;
        return {
          ...status,
          boxes: Array.from({ length: 6 }, (_, i) => ({
            tier:     i + 1,
            marked:   status.markedBoxes.includes(i + 1),
            isActive: i + 1 === highest,
          }))
        };
      }),
      promiseDots: this._buildDots(system.promiseCount, 5),
      fellowship: fellowship ? fellowship.system : null,
    };
  }

  _buildDots(count, max) {
    return Array.from({ length: max }, (_, i) => ({
      value:  i + 1,
      filled: i < count,
    }));
  }

  /* ─── Actions ─────────────────────────────────────── */

  static async _roll(event, target) {
    // Phase 3: open roll dialog
    ui.notifications.info("Roll dialog coming in Phase 3.");
  }

  static async _scratchTag(event, target) {
    const { themeId, tagId, collection } = target.dataset;
    await this.actor.scratchTag(themeId, tagId, collection);
  }

  static async _addTag(event, target) {
    const { themeId, collection } = target.dataset;
    const label = collection === "powerTags" ? "New power tag:" : "New weakness tag:";
    const name = await HeroSheet._prompt(label);
    if (!name) return;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    theme[collection].push({ id: foundry.utils.randomID(), name, scratched: false, singleUse: false });
    return this.actor.update({ "system.themes": themes });
  }

  static async _removeTag(event, target) {
    const { themeId, tagId, collection } = target.dataset;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    theme[collection] = theme[collection].filter(t => t.id !== tagId);
    return this.actor.update({ "system.themes": themes });
  }

  static async _setMight(event, target) {
    const { themeId, might } = target.dataset;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    theme.might = might;
    return this.actor.update({ "system.themes": themes });
  }

  static async _setTrack(event, target) {
    const { themeId, track, value } = target.dataset;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    const current = theme[track];
    // clicking the current filled dot resets to 0; otherwise set to value
    theme[track] = current === Number(value) ? 0 : Number(value);
    return this.actor.update({ "system.themes": themes });
  }

  static async _addStatus(event, target) {
    const statuses = foundry.utils.deepClone(this.actor.system.statuses);
    statuses.push({ id: foundry.utils.randomID(), name: "", tier: 0, markedBoxes: [] });
    return this.actor.update({ "system.statuses": statuses });
  }

  static async _toggleStatusBox(event, target) {
    const { statusId, tier } = target.dataset;
    const t = Number(tier);
    let statuses = foundry.utils.deepClone(this.actor.system.statuses);
    const statusIdx = statuses.findIndex(s => s.id === statusId);
    if (statusIdx === -1) return;
    const status = statuses[statusIdx];

    // Capture any unsaved name currently in the DOM
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

  static async _addBackpackItem(event, target) {
    const backpack = foundry.utils.deepClone(this.actor.system.backpack);
    backpack.push({ id: foundry.utils.randomID(), name: "", scratched: false });
    return this.actor.update({ "system.backpack": backpack });
  }

  static async _scratchBackpackItem(event, target) {
    const backpack = foundry.utils.deepClone(this.actor.system.backpack);
    const item = backpack.find(b => b.id === target.dataset.id);
    if (!item) return;
    item.scratched = !item.scratched;
    return this.actor.update({ "system.backpack": backpack });
  }

  static async _removeBackpackItem(event, target) {
    const backpack = this.actor.system.backpack.filter(b => b.id !== target.dataset.id);
    return this.actor.update({ "system.backpack": backpack });
  }

  static async _addRelationship(event, target) {
    const tags = foundry.utils.deepClone(this.actor.system.relationshipTags);
    tags.push({ id: foundry.utils.randomID(), companionId: "", companionName: "", tag: "", singleUse: true });
    return this.actor.update({ "system.relationshipTags": tags });
  }

  static async _removeRelationship(event, target) {
    const tags = this.actor.system.relationshipTags.filter(r => r.id !== target.dataset.id);
    return this.actor.update({ "system.relationshipTags": tags });
  }

  static async _addQuintessence(event, target) {
    const quints = foundry.utils.deepClone(this.actor.system.quintessences);
    quints.push({ id: foundry.utils.randomID(), name: "", effect: "" });
    return this.actor.update({ "system.quintessences": quints });
  }

  static async _removeQuintessence(event, target) {
    const quints = this.actor.system.quintessences.filter(q => q.id !== target.dataset.id);
    return this.actor.update({ "system.quintessences": quints });
  }

  static async _addSpecialImprovement(event, target) {
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;
    theme.specialImprovements.push({ id: foundry.utils.randomID(), name: "", description: "" });
    return this.actor.update({ "system.themes": themes });
  }

  static async _removeSpecialImprovement(event, target) {
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;
    theme.specialImprovements = theme.specialImprovements.filter(si => si.id !== target.dataset.id);
    return this.actor.update({ "system.themes": themes });
  }

  static async _setPromise(event, target) {
    const value = Number(target.dataset.value);
    const current = this.actor.system.promiseCount;
    // clicking the current filled dot resets to 0
    const next = current === value ? 0 : value;
    return this.actor.update({ "system.promiseCount": next });
  }

  static async _scratchFellowshipTag(event, target) {
    const system = this.actor.system;
    if (!system.fellowshipId) return;
    const fellowship = game.actors.get(system.fellowshipId);
    if (!fellowship) return;

    const { tagType, tagId } = target.dataset;
    const fs = foundry.utils.deepClone(fellowship.system);

    if (tagType === "titleTag") {
      fs.titleTag.scratched = !fs.titleTag.scratched;
      return fellowship.update({ "system.titleTag": fs.titleTag });
    }

    const collection = tagType === "powerTag" ? "powerTags" : "weaknessTags";
    const tag = fs[collection].find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return fellowship.update({ [`system.${collection}`]: fs[collection] });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const input of this.element.querySelectorAll(".sname")) {
      input.addEventListener("change", ev => {
        const idx = Number(ev.target.dataset.statusIndex);
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
  }

  static async _editImage(event, target) {
    const fp = new FilePicker({
      current: this.actor.img,
      type: "image",
      callback: path => this.actor.update({ img: path }),
    });
    return fp.browse();
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
        render:  html => { html.find("#litm-prompt").focus().select(); },
        close:   () => resolve(null),
      }).render(true);
    });
  }
}
