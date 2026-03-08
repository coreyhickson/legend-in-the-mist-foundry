export class LitmActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (this.type !== "hero" || !game.user.isGM) return;
    if (this.system.themes.length > 0) return;
    const themes = Array.from({ length: 4 }, () => ({
      id:                  foundry.utils.randomID(),
      name:                "",
      themebook:           "",
      might:               "origin",
      powerTags:           [],
      weaknessTags:        [],
      quest:               "",
      improveCount:        0,
      abandonCount:        0,
      milestoneCount:      0,
      improvements:        [],
      specialImprovements: []
    }));
    await this.update({ "system.themes": themes });
  }

  async stackStatus(name, tier) {
    const statuses = foundry.utils.deepClone(this.system.statuses);
    const existing = statuses.find(s => s.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      let box = tier;
      while (box <= 6 && existing.markedBoxes.includes(box)) box++;
      if (box <= 6) {
        existing.markedBoxes.push(box);
        existing.markedBoxes.sort((a, b) => a - b);
        existing.tier = existing.markedBoxes[existing.markedBoxes.length - 1];
      }
    } else {
      statuses.push({
        id:          foundry.utils.randomID(),
        name,
        tier,
        markedBoxes: [tier]
      });
    }

    return this.update({ "system.statuses": statuses });
  }

  async reduceStatus(statusId, reduction) {
    const statuses = foundry.utils.deepClone(this.system.statuses);
    const idx = statuses.findIndex(s => s.id === statusId);
    if (idx === -1) return;

    const status = statuses[idx];
    status.markedBoxes = status.markedBoxes
      .map(b => b - reduction)
      .filter(b => b >= 1);

    if (status.markedBoxes.length === 0) {
      statuses.splice(idx, 1);
    } else {
      status.tier = status.markedBoxes[status.markedBoxes.length - 1];
    }

    return this.update({ "system.statuses": statuses });
  }

  async scratchTag(themeId, tagId, collection) {
    const themes = foundry.utils.deepClone(this.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    const tag = theme[collection]?.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.update({ "system.themes": themes });
  }

  // Burning scratches the tag and grants +3 Power at roll time.
  // The tag is scratched (unavailable) until recovered at camping.
  async burnTag(themeId, tagId) {
    const themes = foundry.utils.deepClone(this.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    const tag = theme.powerTags?.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = true;
    return this.update({ "system.themes": themes });
  }
}

export class LitmItem extends Item {}
