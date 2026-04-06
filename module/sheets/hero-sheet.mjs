import { RollPanel } from "../apps/roll-panel.mjs";
import { ApplyKitDialog } from "../apps/apply-kit-dialog.mjs";
import { ApplyTropeDialog } from "../apps/apply-trope-dialog.mjs";
import { enableInlineEdit, showContextMenu } from "../utils.mjs";
import { _getAllThemeKits } from "./trope-sheet.mjs";

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
      scratchThemeTitle:        HeroSheet._scratchThemeTitle,
      setThemeTitle:            HeroSheet._setThemeTitle,
      scratchTag:               HeroSheet._scratchTag,
      editTagGroup:             HeroSheet._editTagGroup,
      addTag:                   HeroSheet._addTag,
      removeTag:                HeroSheet._removeTag,
      cycleMight:               HeroSheet._cycleMight,
      setTrack:                 HeroSheet._setTrack,
      addStatus:                HeroSheet._addStatus,
      toggleStatusBox:          HeroSheet._toggleStatusBox,
      reduceStatus:             HeroSheet._reduceStatus,
      addBackpackItem:          HeroSheet._addBackpackItem,
      scratchBackpackItem:      HeroSheet._scratchBackpackItem,
      removeBackpackItem:       HeroSheet._removeBackpackItem,
      addRelationship:          HeroSheet._addRelationship,
      removeRelationship:       HeroSheet._removeRelationship,
      addQuintessence:          HeroSheet._addQuintessence,
      removeQuintessence:       HeroSheet._removeQuintessence,
      addTheme:                 HeroSheet._addTheme,
      removeTheme:              HeroSheet._removeTheme,
      addSpecialImprovement:    HeroSheet._addSpecialImprovement,
      removeSpecialImprovement: HeroSheet._removeSpecialImprovement,
      setPromise:               HeroSheet._setPromise,
      scratchFellowshipTag:     HeroSheet._scratchFellowshipTag,
      linkFellowship:           HeroSheet._linkFellowship,
      editImage:                HeroSheet._editImage,
      addStoryTheme:            HeroSheet._addStoryTheme,
      removeStoryTheme:         HeroSheet._removeStoryTheme,
      scratchStoryThemeTitle:   HeroSheet._scratchStoryThemeTitle,
      scratchStoryThemeTag:     HeroSheet._scratchStoryThemeTag,
      applyKit:                 HeroSheet._applyKit,
      addThemeFromKit:          HeroSheet._addThemeFromKit,
      applyTrope:               HeroSheet._applyTrope,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/sheets/hero-sheet.hbs"
    }
  };

  async render(options = {}) {
    const el = this.element;
    if (el) {
      this._savedScroll = {
        themes: el.querySelector('.themes-col')?.scrollTop ?? 0,
        cpanel: el.querySelector('.cpanel-body')?.scrollTop ?? 0,
        right:  el.querySelector('.right-col')?.scrollTop ?? 0,
      };
      const active = document.activeElement;
      if (el.contains(active)) {
        if (active.classList.contains("st-theme-title-inp") && active.dataset.id)
          this._pendingFocusSelector = `.st-theme-title-inp[data-id="${active.dataset.id}"]`;
        else if (active.classList.contains("st-theme-tag-inp") && active.dataset.themeId && active.dataset.tagId)
          this._pendingFocusSelector = `.st-theme-tag-inp[data-theme-id="${active.dataset.themeId}"][data-tag-id="${active.dataset.tagId}"]`;
      }
    }
    return super.render(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    const fellowship = system.fellowshipId
      ? game.actors.get(system.fellowshipId)
      : null;

    const DEFAULT_PORTRAIT = 'icons/svg/mystery-man.svg';
    return {
      ...context,
      actor: this.actor,
      system,
      hasPortrait: !!(this.actor.img && this.actor.img !== DEFAULT_PORTRAIT),
      themes: system.themes.map((theme, ti) => ({
        ...theme,
        themeIndex: ti,
        mightIcon:     { origin: "🌿", adventure: "⚔️", greatness: "👑" }[theme.might] ?? "🌿",
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
      storyThemes: system.storyThemes ?? [],
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
    this._rollPanel.toggle();
  }

  static async _setThemeTitle(event, target) {
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;
    const name = await HeroSheet._prompt("Title tag:", theme.name ?? "");
    if (name === null) return;
    theme.name = name;
    return this.actor.update({ "system.themes": themes });
  }

  static async _scratchThemeTitle(event, target) {
    if (event.target.tagName === "INPUT") return;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;
    theme.titleScratched = !theme.titleScratched;
    return this.actor.update({ "system.themes": themes });
  }

  static async _editTagGroup(event, target) {
    const { themeId } = target.dataset;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;

    const allTags = [
      ...theme.powerTags.map(t => ({ ...t, collection: "powerTags" })),
      ...theme.weaknessTags.map(t => ({ ...t, collection: "weaknessTags" })),
    ];

    const titleRow = `<div class="litm-tag-row" data-collection="title" style="display:table;width:100%;margin-bottom:6px;table-layout:fixed;">
      <div style="display:table-cell;width:90px;padding-right:6px;vertical-align:middle;">
        <span style="font-size:11px;font-family:sans-serif;color:#888;text-transform:uppercase;letter-spacing:1px;">Title</span>
      </div>
      <div style="display:table-cell;width:100%;padding-right:6px;">
        <input type="text" value="${theme.name ?? ""}" style="width:100%;box-sizing:border-box;padding:3px 6px;font-size:13px;" placeholder="Title tag…">
      </div>
      <div style="display:table-cell;width:24px;vertical-align:middle;"></div>
    </div>`;

    const tagRows = allTags.map(t =>
      `<div class="litm-tag-row" data-id="${t.id}" data-collection="${t.collection}" style="display:table;width:100%;margin-bottom:6px;table-layout:fixed;">
        <div style="display:table-cell;width:90px;padding-right:6px;vertical-align:middle;">
          <select style="width:100%;padding:2px 4px;font-size:12px;">
            <option value="powerTags" ${t.collection === "powerTags" ? "selected" : ""}>Power</option>
            <option value="weaknessTags" ${t.collection === "weaknessTags" ? "selected" : ""}>Weakness</option>
          </select>
        </div>
        <div style="display:table-cell;width:100%;padding-right:6px;">
          <input type="text" value="${t.name}" style="width:100%;box-sizing:border-box;padding:3px 6px;font-size:13px;">
        </div>
        <div style="display:table-cell;width:24px;vertical-align:middle;text-align:center;">
          <button type="button" class="litm-tag-del" style="background:none;border:none;cursor:pointer;font-size:13px;opacity:0.5;padding:0;line-height:1;">✕</button>
        </div>
      </div>`
    ).join("");

    const saved = await new Promise(resolve => {
      const d = new Dialog({
        title: "Edit Tags",
        content: `<div id="litm-tag-list" style="padding:6px 0 4px;width:100%;box-sizing:border-box;">${titleRow}<hr style="margin:6px 0;border:none;border-top:1px solid #ccc;">${tagRows}</div>`,
        buttons: {
          save:   { label: "Save",   callback: html => resolve(html) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "save",
        render:  html => {
          html.find(".litm-tag-del").on("click", function() { $(this).closest(".litm-tag-row").remove(); });
          setTimeout(() => html.find("input").first().focus().select(), 0);
        },
        close: () => resolve(null),
      });
      d.render(true);
    });

    if (!saved) return;

    // Save title tag
    const titleInput = saved.find(".litm-tag-row[data-collection='title'] input").val().trim();
    theme.name = titleInput || "";

    // Save power/weakness tags
    theme.powerTags = [];
    theme.weaknessTags = [];
    saved.find(".litm-tag-row:not([data-collection='title'])").each(function() {
      const id         = this.dataset.id;
      const collection = $(this).find("select").val();
      const name       = $(this).find("input").val().trim();
      if (!name) return;
      const orig = allTags.find(t => t.id === id);
      theme[collection].push({ id, name, scratched: orig?.scratched ?? false, singleUse: orig?.singleUse ?? false });
    });
    return this.actor.update({ "system.themes": themes });
  }

  static async _scratchTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const { themeId, tagId, collection } = target.dataset;
    await this.actor.scratchTag(themeId, tagId, collection);
  }

  static async _addTag(event, target) {
    const { themeId } = target.dataset;
    const result = await new Promise(resolve => {
      new Dialog({
        title: "Add Tag",
        content: `<div style="padding:4px 0 8px">
          <div style="margin-bottom:8px">
            <label><input type="radio" name="tagType" value="powerTags" checked> ${game.i18n.localize('LITM.Tag.Power')}</label>
            <label style="margin-left:12px"><input type="radio" name="tagType" value="weaknessTags"> ${game.i18n.localize('LITM.Tag.Weakness')}</label>
          </div>
          <input id="litm-tag-name" type="text" style="width:100%" placeholder="Tag name…">
        </div>`,
        buttons: {
          ok:     { label: "Add",    callback: html => resolve({ collection: html.find("input[name=tagType]:checked").val(), name: html.find("#litm-tag-name").val().trim() }) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        render:  html => setTimeout(() => html.find("#litm-tag-name").focus(), 0),
        close:   () => resolve(null),
      }).render(true);
    });
    if (!result?.name) return;
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    theme[result.collection].push({ id: foundry.utils.randomID(), name: result.name, scratched: false, singleUse: false });
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

  static async _cycleMight(event, target) {
    const cycle = { origin: "adventure", adventure: "greatness", greatness: "origin" };
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    const theme = themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;
    theme.might = cycle[theme.might] ?? "origin";
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

  static async _reduceStatus(event, target) {
    await this.actor.reduceStatus(target.dataset.statusId, 1);
  }

  static async _addStatus(event, target) {
    const statuses = foundry.utils.deepClone(this.actor.system.statuses);
    const id = foundry.utils.randomID();
    statuses.push({ id, name: "", tier: 0, markedBoxes: [] });
    this._focusStatusId = id;
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
    const id = foundry.utils.randomID();
    backpack.push({ id, name: "", scratched: false });
    this._focusBackpackId = id;
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

  static async _addTheme(event, target) {
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    themes.push({
      id:             foundry.utils.randomID(),
      name:           "",
      titleScratched: false,
      themebook:      "",
      might:          "origin",
      powerTags:      [],
      weaknessTags:   [],
      quest:          "",
      improveCount:   0,
      abandonCount:   0,
      milestoneCount: 0,
      improvements:   [],
      specialImprovements: []
    });
    return this.actor.update({ "system.themes": themes });
  }

  static async _removeTheme(event, target) {
    const theme = this.actor.system.themes.find(t => t.id === target.dataset.themeId);
    if (!theme) return;

    if (theme.name) {
      const confirmed = await new Promise(resolve => {
        new Dialog({
          title: "Remove Theme",
          content: `<p style="margin-bottom:6px">Type the title tag to confirm deletion:</p>
                    <div style="padding:2px 0 8px"><input id="litm-confirm" type="text" style="width:100%" placeholder="${theme.name}"></div>`,
          buttons: {
            ok:     { label: "Delete", callback: html => resolve(html.find("#litm-confirm").val().trim()) },
            cancel: { label: "Cancel", callback: () => resolve(null) }
          },
          default: "cancel",
          render:  html => setTimeout(() => html.find("#litm-confirm").focus(), 0),
          close:   () => resolve(null),
        }).render(true);
      });
      if (confirmed === null) return;
      if (confirmed !== theme.name) {
        ui.notifications.warn("Title tag did not match — theme not deleted.");
        return;
      }
    } else {
      const ok = await Dialog.confirm({ title: "Remove Theme", content: "Remove this theme?" });
      if (!ok) return;
    }

    const themes = this.actor.system.themes.filter(t => t.id !== target.dataset.themeId);
    return this.actor.update({ "system.themes": themes });
  }

  static async _addStoryTheme(event, target) {
    const themes = foundry.utils.deepClone(this.actor.system.storyThemes ?? []);
    themes.push({
      id:             foundry.utils.randomID(),
      name:           "",
      titleScratched: false,
      powerTags: [
        { id: foundry.utils.randomID(), name: "", scratched: false, singleUse: false },
        { id: foundry.utils.randomID(), name: "", scratched: false, singleUse: false },
      ],
      weaknessTags: [
        { id: foundry.utils.randomID(), name: "", scratched: false, singleUse: false },
      ],
      visible: true,
    });
    return this.actor.update({ "system.storyThemes": themes });
  }

  static async _removeStoryTheme(event, target) {
    const themes = (this.actor.system.storyThemes ?? []).filter(th => th.id !== target.dataset.id);
    return this.actor.update({ "system.storyThemes": themes });
  }

  static async _scratchStoryThemeTitle(event, target) {
    if (event.target.tagName === "INPUT") return;
    const themes = foundry.utils.deepClone(this.actor.system.storyThemes ?? []);
    const theme  = themes.find(th => th.id === target.dataset.id);
    if (!theme) return;
    theme.titleScratched = !theme.titleScratched;
    return this.actor.update({ "system.storyThemes": themes });
  }

  static async _scratchStoryThemeTag(event, target) {
    if (event.target.tagName === "INPUT") return;
    const { id: themeId, tagId, collection } = target.dataset;
    const themes = foundry.utils.deepClone(this.actor.system.storyThemes ?? []);
    const theme  = themes.find(th => th.id === themeId);
    if (!theme) return;
    const tag = theme[collection]?.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.actor.update({ "system.storyThemes": themes });
  }

  static async _applyKit(event, target) {
    const themeId = target.dataset.themeId;
    const result  = await ApplyKitDialog.show();
    if (!result) return;
    await HeroSheet._applyKitToTheme(this.actor, themeId, result.kit, result.selectedPower, result.selectedWeakness);
  }

  static async _addThemeFromKit(event, target) {
    const result = await ApplyKitDialog.show();
    if (!result) return;
    const newId  = foundry.utils.randomID();
    const themes = foundry.utils.deepClone(this.actor.system.themes);
    themes.push({
      id:             newId,
      name:           "",
      titleScratched: false,
      themebook:      "",
      might:          "origin",
      powerTags:      [],
      weaknessTags:   [],
      quest:          "",
      improveCount:   0,
      abandonCount:   0,
      milestoneCount: 0,
      improvements:   [],
      specialImprovements: []
    });
    await this.actor.update({ "system.themes": themes });
    await HeroSheet._applyKitToTheme(this.actor, newId, result.kit, result.selectedPower, result.selectedWeakness);
  }

  static async _applyKitToTheme(actor, themeId, kit, selectedPower, selectedWeakness) {
    const s      = kit.system;
    const id     = () => foundry.utils.randomID();
    const themes = foundry.utils.deepClone(actor.system.themes);
    const theme  = themes.find(t => t.id === themeId);
    if (!theme) return;

    const powerList   = selectedPower   ?? (s.powerTags   ?? []);
    const weakList    = selectedWeakness ?? (s.weaknessTags ?? []);

    theme.name           = s.titleTag ?? "";
    theme.themebook      = s.themebookName ?? "";
    theme.might          = s.might ?? "origin";
    theme.powerTags      = powerList.map(name => ({ id: id(), name, scratched: false, singleUse: false }));
    theme.weaknessTags   = weakList.map(name => ({ id: id(), name, scratched: false, singleUse: false }));
    theme.quest          = s.quest ?? "";
    theme.specialImprovements = (s.specialImprovements ?? []).map(si => ({ id: id(), name: si.name, description: si.description }));

    return actor.update({ "system.themes": themes });
  }

  static async _applyTrope(event, target) {
    const result = await ApplyTropeDialog.show();
    if (!result) return;
    const { trope, choiceId, presetSelections, choiceSelection, selectedBackpack } = result;
    const s = trope.system;

    const presetIds = (s.presetKitIds ?? []).filter(Boolean);
    const kitIds    = [...presetIds];
    if (choiceId) kitIds.push(choiceId);

    const actor  = this.actor;
    const themes = foundry.utils.deepClone(actor.system.themes);
    const mkId   = () => foundry.utils.randomID();

    for (let i = 0; i < Math.min(kitIds.length, themes.length); i++) {
      const kit = game.items.get(kitIds[i]);
      if (!kit) continue;
      const ks  = kit.system;
      const isChoice = i >= presetIds.length;
      const sel = isChoice ? choiceSelection : presetSelections?.[i];

      themes[i].name           = ks.titleTag ?? "";
      themes[i].themebook      = ks.themebookName ?? "";
      themes[i].might          = ks.might ?? "origin";
      themes[i].powerTags      = (sel?.selectedPower    ?? []).map(name => ({ id: mkId(), name, scratched: false, singleUse: false }));
      themes[i].weaknessTags   = (sel?.selectedWeakness ?? []).map(name => ({ id: mkId(), name, scratched: false, singleUse: false }));
      themes[i].quest          = ks.quest ?? "";
      themes[i].specialImprovements = (ks.specialImprovements ?? []).map(si => ({ id: mkId(), name: si.name, description: si.description }));
    }

    // Append selected backpack items
    const backpack = foundry.utils.deepClone(actor.system.backpack ?? []);
    for (const name of (selectedBackpack ?? [])) {
      backpack.push({ id: mkId(), name, scratched: false });
    }

    await actor.update({ "system.themes": themes, "system.backpack": backpack, "system.trope": trope.name });
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

    if (!this._rollPanel) this._rollPanel = new RollPanel(this);
    this._rollPanel.restore();

    // Edit mode toggle
    const sheetEl = this.element.querySelector('.litm-hero-sheet');
    const editBtn = this.element.querySelector('.edit-toggle-btn');
    if (!this.hasOwnProperty('_editMode')) {
      const saved = localStorage.getItem(`litm.editMode.hero.${this.actor.id}`);
      this._editMode = saved !== null ? saved === 'true' : !this.actor.pack;
    }
    if (sheetEl) sheetEl.classList.toggle('is-editing', this._editMode);
    if (editBtn) {
      editBtn.classList.toggle('active', this._editMode);
      editBtn.addEventListener('click', () => {
        this._editMode = !this._editMode;
        localStorage.setItem(`litm.editMode.hero.${this.actor.id}`, this._editMode);
        sheetEl?.classList.toggle('is-editing', this._editMode);
        editBtn.classList.toggle('active', this._editMode);
      });
    }

    // Theme minimize toggles
    if (!this._minimizedThemes) this._minimizedThemes = new Set();
    for (const card of this.element.querySelectorAll('.theme-card[data-theme-id]')) {
      const id  = card.dataset.themeId;
      const btn = card.querySelector('.theme-minimize-btn');
      const isMin = this._minimizedThemes.has(id);
      card.classList.toggle('minimized', isMin);
      if (btn) {
        btn.textContent = isMin ? '▸' : '▾';
        btn.addEventListener('click', () => {
          const nowMin = !this._minimizedThemes.has(id);
          nowMin ? this._minimizedThemes.add(id) : this._minimizedThemes.delete(id);
          card.classList.toggle('minimized', nowMin);
          btn.textContent = nowMin ? '▸' : '▾';
        });
      }
    }

    // Backpack item click to scratch (clicking the item text, not buttons/inputs)
    for (const item of this.element.querySelectorAll(".bp-item[data-id]")) {
      item.addEventListener("click", async ev => {
        if (ev.target.closest("button, input")) return;
        const backpack = foundry.utils.deepClone(this.actor.system.backpack);
        const bp = backpack.find(b => b.id === item.dataset.id);
        if (!bp) return;
        bp.scratched = !bp.scratched;
        await this.actor.update({ "system.backpack": backpack });
      });
    }

    // Focus newly added status
    if (this._focusStatusId) {
      const id = this._focusStatusId;
      this._focusStatusId = null;
      enableInlineEdit(this.element.querySelector(`.status-pill[data-status-id="${id}"] .sname`));
    }

    // Focus newly added backpack item
    if (this._focusBackpackId) {
      const id = this._focusBackpackId;
      this._focusBackpackId = null;
      enableInlineEdit(this.element.querySelector(`.bp-item[data-id="${id}"] .bp-inp`));
    }

    // Context menus
    for (const tagEl of this.element.querySelectorAll(".ch-tag[data-tag-id]")) {
      tagEl.addEventListener("contextmenu", ev => {
        const { themeId, tagId, collection } = tagEl.dataset;
        const isScratched = tagEl.classList.contains("scratched");
        showContextMenu(ev, [
          { label: "Edit", action: () => enableInlineEdit(tagEl.querySelector(".theme-tag-inp")) },
          { label: isScratched ? "Unscratch" : "Scratch", action: () => this.actor.scratchTag(themeId, tagId, collection) },
          { label: "Remove", danger: true, action: () => {
            const themes = foundry.utils.deepClone(this.actor.system.themes);
            const theme = themes.find(t => t.id === themeId);
            if (!theme) return;
            theme[collection] = theme[collection].filter(t => t.id !== tagId);
            this.actor.update({ "system.themes": themes });
          }},
        ]);
      });
    }

    for (const pillEl of this.element.querySelectorAll(".status-pill[data-status-id]")) {
      pillEl.addEventListener("contextmenu", ev => {
        const statusId = pillEl.dataset.statusId;
        showContextMenu(ev, [
          { label: "Edit", action: () => enableInlineEdit(pillEl.querySelector(".sname")) },
          { label: "Reduce (−1)", action: () => this.actor.reduceStatus(statusId, 1) },
          { label: "Remove", danger: true, action: () => {
            const statuses = this.actor.system.statuses.filter(s => s.id !== statusId);
            this.actor.update({ "system.statuses": statuses });
          }},
        ]);
      });
    }

    for (const itemEl of this.element.querySelectorAll(".bp-item[data-id]")) {
      itemEl.addEventListener("contextmenu", ev => {
        const id = itemEl.dataset.id;
        const isScratched = itemEl.classList.contains("scratched");
        showContextMenu(ev, [
          { label: "Edit", action: () => enableInlineEdit(itemEl.querySelector(".bp-inp")) },
          { label: isScratched ? "Unscratch" : "Scratch", action: () => {
            const backpack = foundry.utils.deepClone(this.actor.system.backpack);
            const item = backpack.find(b => b.id === id);
            if (!item) return;
            item.scratched = !item.scratched;
            this.actor.update({ "system.backpack": backpack });
          }},
          { label: "Remove", danger: true, action: () => {
            const backpack = this.actor.system.backpack.filter(b => b.id !== id);
            this.actor.update({ "system.backpack": backpack });
          }},
        ]);
      });
    }

    // Story theme title inline editing
    for (const input of this.element.querySelectorAll(".st-theme-title-inp[data-id]")) {
      input.addEventListener("change", async ev => {
        // Capture focus synchronously before the async update triggers a re-render
        const active = document.activeElement;
        if (this.element?.contains(active) && active !== ev.target) {
          if (active.classList.contains("st-theme-tag-inp") && active.dataset.themeId && active.dataset.tagId)
            this._pendingFocusSelector = `.st-theme-tag-inp[data-theme-id="${active.dataset.themeId}"][data-tag-id="${active.dataset.tagId}"]`;
          else if (active.classList.contains("st-theme-title-inp") && active.dataset.id)
            this._pendingFocusSelector = `.st-theme-title-inp[data-id="${active.dataset.id}"]`;
        }
        const themes = foundry.utils.deepClone(this.actor.system.storyThemes ?? []);
        const theme  = themes.find(th => th.id === ev.target.dataset.id);
        if (!theme) return;
        theme.name = ev.target.value.trim();
        await this.actor.update({ "system.storyThemes": themes });
      });
    }

    // Story theme power/weakness tag inline editing
    for (const input of this.element.querySelectorAll(".st-theme-tag-inp[data-theme-id]")) {
      input.addEventListener("change", async ev => {
        const { themeId, tagId, collection } = ev.target.dataset;
        const themes = foundry.utils.deepClone(this.actor.system.storyThemes ?? []);
        const theme  = themes.find(th => th.id === themeId);
        if (!theme) return;
        const tag = theme[collection]?.find(t => t.id === tagId);
        if (!tag) return;
        tag.name = ev.target.value.trim();
        await this.actor.update({ "system.storyThemes": themes });
      });
    }

    // Relationship item click to scratch
    for (const item of this.element.querySelectorAll(".rel-item[data-id]")) {
      item.addEventListener("click", async ev => {
        if (ev.target.closest("button, input")) return;
        const tags = foundry.utils.deepClone(this.actor.system.relationshipTags);
        const rel = tags.find(r => r.id === item.dataset.id);
        if (!rel) return;
        rel.scratched = !rel.scratched;
        await this.actor.update({ "system.relationshipTags": tags });
      });

      item.addEventListener("contextmenu", ev => {
        const id = item.dataset.id;
        const rel = this.actor.system.relationshipTags.find(r => r.id === id);
        if (!rel) return;
        showContextMenu(ev, [
          { label: "Edit companion", action: () => enableInlineEdit(item.querySelector(".rel-companion")) },
          { label: "Edit tag",       action: () => enableInlineEdit(item.querySelector(".rel-tag")) },
          { label: rel.scratched ? "Unscratch" : "Scratch", action: async () => {
            const tags = foundry.utils.deepClone(this.actor.system.relationshipTags);
            const r = tags.find(r => r.id === id);
            if (!r) return;
            r.scratched = !r.scratched;
            await this.actor.update({ "system.relationshipTags": tags });
          }},
          { label: "Remove", danger: true, action: () => {
            const tags = this.actor.system.relationshipTags.filter(r => r.id !== id);
            this.actor.update({ "system.relationshipTags": tags });
          }},
        ]);
      });
    }

    // Theme title inline editing
    for (const input of this.element.querySelectorAll(".theme-title-inp[data-theme-id]")) {
      input.addEventListener("change", async ev => {
        const themes = foundry.utils.deepClone(this.actor.system.themes);
        const theme = themes.find(t => t.id === ev.target.dataset.themeId);
        if (!theme) return;
        theme.name = ev.target.value.trim();
        await this.actor.update({ "system.themes": themes });
      });
    }

    // Theme tag inline editing (delete if empty)
    for (const input of this.element.querySelectorAll(".theme-tag-inp[data-tag-id]")) {
      input.addEventListener("change", async ev => {
        const { themeId, tagId, collection } = ev.target.dataset;
        const themes = foundry.utils.deepClone(this.actor.system.themes);
        const theme = themes.find(t => t.id === themeId);
        if (!theme) return;
        const name = ev.target.value.trim();
        if (!name) {
          theme[collection] = theme[collection].filter(t => t.id !== tagId);
        } else {
          const tag = theme[collection].find(t => t.id === tagId);
          if (tag) tag.name = name;
        }
        await this.actor.update({ "system.themes": themes });
      });
    }

    if (this._savedScroll) {
      const el = this.element;
      const themes = el.querySelector('.themes-col');
      const cpanel = el.querySelector('.cpanel-body');
      const right  = el.querySelector('.right-col');
      if (themes) themes.scrollTop = this._savedScroll.themes;
      if (cpanel) cpanel.scrollTop = this._savedScroll.cpanel;
      if (right)  right.scrollTop  = this._savedScroll.right;
      this._savedScroll = null;
    }

    // Theme type inputs
    for (const input of this.element.querySelectorAll(".theme-type-input")) {
      input.addEventListener("change", async ev => {
        const themes = foundry.utils.deepClone(this.actor.system.themes);
        const theme = themes.find(t => t.id === ev.target.dataset.themeId);
        if (!theme) return;
        theme.themebook = ev.target.value.trim();
        await this.actor.update({ "system.themes": themes });
      });
    }

    // Quest inputs
    for (const input of this.element.querySelectorAll(".quest-input")) {
      input.addEventListener("change", async ev => {
        const themes = foundry.utils.deepClone(this.actor.system.themes);
        const theme = themes.find(t => t.id === ev.target.dataset.themeId);
        if (!theme) return;
        theme.quest = ev.target.value.trim();
        await this.actor.update({ "system.themes": themes });
      });
    }

    // Special improvement inputs
    for (const input of this.element.querySelectorAll(".si-name, .si-desc")) {
      input.addEventListener("change", async ev => {
        const themes = foundry.utils.deepClone(this.actor.system.themes);
        const theme = themes.find(t => t.id === ev.target.dataset.themeId);
        if (!theme) return;
        const si = theme.specialImprovements.find(s => s.id === ev.target.dataset.siId);
        if (!si) return;
        si[ev.target.classList.contains("si-name") ? "name" : "description"] = ev.target.value.trim();
        await this.actor.update({ "system.themes": themes });
      });
    }

    const resizeSname = input => {
      const text = input.value || input.placeholder || "";
      const span = document.createElement("span");
      span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(input).font}`;
      span.textContent = text;
      document.body.appendChild(span);
      input.style.width = Math.max(span.offsetWidth + 4, 30) + "px";
      document.body.removeChild(span);
    };

    for (const input of this.element.querySelectorAll(".sname")) {
      resizeSname(input);
      input.addEventListener("input", () => resizeSname(input));
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

    // Restore focus lost to re-render (e.g. when tabbing between tag inputs)
    if (this._pendingFocusSelector) {
      const sel = this._pendingFocusSelector;
      this._pendingFocusSelector = null;
      this.element.querySelector(sel)?.focus();
    }
  }

  static async _linkFellowship(event, target) {
    const fellowships = game.actors.filter(a => a.type === "fellowship");
    if (!fellowships.length) {
      ui.notifications.warn("No fellowship actors found. Create a fellowship actor first.");
      return;
    }
    const options = fellowships.map(f => `<option value="${f.id}" ${f.id === this.actor.system.fellowshipId ? "selected" : ""}>${f.name}</option>`).join("");
    const content = `<div style="padding:4px 0 8px">
      <select id="litm-fellowship-sel" style="width:100%;padding:3px 6px;font-size:13px;">${options}</select>
    </div>`;
    const id = await new Promise(resolve => {
      new Dialog({
        title: "Link Fellowship",
        content,
        buttons: {
          ok:     { label: "Link",   callback: html => resolve(html.find("#litm-fellowship-sel").val()) },
          unlink: { label: "Unlink", callback: () => resolve("") },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null),
      }).render(true);
    });
    if (id === null) return;
    return this.actor.update({ "system.fellowshipId": id });
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
        render:  html => { setTimeout(() => html.find("#litm-prompt").focus().select(), 0); },
        close:   () => resolve(null),
      }).render(true);
    });
  }
}
