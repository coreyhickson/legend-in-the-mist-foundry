export class LitmActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  /* ─── Status helpers ──────────────────────────────── */

  /**
   * Stack a status onto this actor. If a status with the same name exists,
   * mark the new tier box (or the next available box if already marked).
   * Otherwise add a new status entry.
   * @param {string} name
   * @param {"positive"|"negative"} polarity
   * @param {number} tier  1–6
   */
  async stackStatus(name, polarity, tier) {
    const statuses = foundry.utils.deepClone(this.system.statuses);
    const existing = statuses.find(s => s.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      // Mark the requested tier box; if taken, shift right until an open box is found
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
        polarity,
        tier,
        markedBoxes: [tier]
      });
    }

    return this.update({ "system.statuses": statuses });
  }

  /**
   * Reduce a status by shifting all marked boxes left by the given amount,
   * removing any that drop below 1.
   * @param {string} statusId
   * @param {number} reduction
   */
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

  /**
   * Mark an Improve box on the given theme (by theme ID or index).
   * Automatically fires if the theme reaches 3 (or 5 for Diligent Drudge).
   * @param {string} themeId
   */
  async markImprove(themeId) {
    const themes = foundry.utils.deepClone(this.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;

    theme.improveCount = Math.min(theme.improveCount + 1, 5);
    return this.update({ "system.themes": themes });
  }

  /* ─── Tag helpers ─────────────────────────────────── */

  /**
   * Scratch or un-scratch a power/weakness tag within a theme.
   * @param {string} themeId
   * @param {string} tagId
   * @param {"powerTags"|"weaknessTags"} collection
   */
  async scratchTag(themeId, tagId, collection) {
    const themes = foundry.utils.deepClone(this.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    const tag = theme[collection]?.find(t => t.id === tagId);
    if (!tag) return;
    tag.scratched = !tag.scratched;
    return this.update({ "system.themes": themes });
  }

  /**
   * Burn a power tag within a theme (marks it scratched, was used for +3 Power).
   */
  async burnTag(themeId, tagId) {
    const themes = foundry.utils.deepClone(this.system.themes);
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    const tag = theme.powerTags?.find(t => t.id === tagId);
    if (!tag) return;
    tag.burned = true;
    tag.scratched = false;
    return this.update({ "system.themes": themes });
  }
}

export class LitmItem extends Item {}
