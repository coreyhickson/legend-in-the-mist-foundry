const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PANEL_TEMPLATE = 'systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs';
const CARD_TEMPLATE  = 'systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs';

export class RollPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:       'litm-roll-panel',
    classes:  ['litm', 'roll-panel-app'],
    position: { width: 560 },
    window:   { resizable: false },
  };

  static PARTS = {
    panel: { template: PANEL_TEMPLATE }
  };

  constructor(sheet) {
    super({});
    this.sheet      = sheet;
    this.actor      = sheet.actor;
    this.isOpen     = false;
    this.rollType   = null;
    this.selected   = new Map();
    this.result     = null;
    this.adjustment = 0;
  }

  get title() {
    const TYPE_LABELS = { quick: 'Quick Roll', detailed: 'Detailed Roll', reaction: 'Reaction Roll' };
    return TYPE_LABELS[this.rollType] ?? 'Roll';
  }

  /* ── Public API ─────────────────────────────────── */

  toggle(type) {
    if (this.isOpen && this.rollType === type) {
      this.close();
    } else {
      this.isOpen     = true;
      this.rollType   = type;
      this.selected.clear();
      this.result     = null;
      this.adjustment = 0;
      this.render({ force: true });
    }
    this._syncButtons();
  }

  async close(options = {}) {
    this.isOpen   = false;
    this.rollType = null;
    this.selected.clear();
    this.result   = null;
    this._syncButtons();
    return super.close(options);
  }

  /** Called from hero sheet _onRender — keeps roll buttons in sync. */
  restore() {
    this._syncButtons();
  }

  /* ── Rendering ──────────────────────────────────── */

  async _prepareContext(options) {
    return this._buildContext();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._attachListeners();
  }

  _syncButtons() {
    if (!this.sheet.element) return;
    for (const btn of this.sheet.element.querySelectorAll('.roll-btn')) {
      btn.classList.toggle('active', this.isOpen && btn.dataset.rollType === this.rollType);
    }
  }

  /* ── Context ────────────────────────────────────── */

  _buildTagPool() {
    const sys    = this.actor.system;
    const groups = [];

    // Themes
    for (const theme of sys.themes) {
      const themeName = theme.name || 'Theme';
      const tags = [];
      for (const t of theme.powerTags.filter(t => !t.scratched))
        tags.push({ id: t.id, name: t.name, kind: 'power', source: themeName });
      for (const t of theme.weaknessTags.filter(t => !t.scratched))
        tags.push({ id: t.id, name: t.name, kind: 'weakness', source: themeName });
      if (tags.length) groups.push({ label: themeName, tags });
    }

    // Fellowship
    if (sys.fellowshipId) {
      const fellowship = game.actors.get(sys.fellowshipId);
      if (fellowship) {
        const fs   = fellowship.system;
        const tags = [];
        if (fs.titleTag?.name && !fs.titleTag.scratched)
          tags.push({ id: 'f-title', name: fs.titleTag.name, kind: 'power', source: 'Fellowship' });
        for (const t of (fs.powerTags   || []).filter(t => !t.scratched))
          tags.push({ id: `f-${t.id}`, name: t.name, kind: 'power', source: 'Fellowship' });
        for (const t of (fs.weaknessTags || []).filter(t => !t.scratched))
          tags.push({ id: `f-${t.id}`, name: t.name, kind: 'weakness', source: 'Fellowship' });
        if (tags.length) groups.push({ label: 'Fellowship', tags });
      }
    }

    // Relationships
    const rels = (sys.relationshipTags || []).filter(r => r.tag);
    if (rels.length)
      groups.push({ label: 'Relationships', tags: rels.map(r => ({ id: r.id, name: r.tag, kind: 'power', source: 'Relationships' })) });

    // Backpack
    const bp = (sys.backpack || []).filter(b => b.name && !b.scratched);
    if (bp.length)
      groups.push({ label: 'Backpack', tags: bp.map(b => ({ id: b.id, name: b.name, kind: 'power', source: 'Backpack' })) });

    // Statuses
    const statuses = (sys.statuses || []).filter(s => s.name && s.markedBoxes.length);
    if (statuses.length)
      groups.push({ label: 'Statuses', tags: statuses.map(s => ({ id: s.id, name: `${s.name}-${s.tier}`, kind: 'status', tier: s.tier, source: 'Statuses' })) });

    return groups;
  }

  _buildContext() {
    const groups = this._buildTagPool();

    for (const group of groups) {
      for (const tag of group.tags) {
        const sel      = this.selected.get(tag.id);
        tag.isSelected = !!sel;
        tag.isNegative = sel?.polarity === 'negative';
        tag.isBurned   = sel?.polarity === 'burned';
      }
    }

    const { tagPower, bestPos, worstNeg, entries } = this._tallyBreakdown();
    const power = tagPower + bestPos - worstNeg + this.adjustment;

    const TYPE_LABELS = { quick: 'Quick Roll', detailed: 'Detailed Roll', reaction: 'Reaction Roll' };

    return {
      rollTypeLabel: TYPE_LABELS[this.rollType] ?? '',
      groups,
      entries,
      power,
      powerLabel:   power > 0 ? `+${power}` : `${power}`,
      powerClass:   power > 0 ? 'pos' : power < 0 ? 'neg' : '',
      adjustLabel:  this.adjustment > 0 ? `+${this.adjustment}` : `${this.adjustment}`,
      adjustClass:  this.adjustment > 0 ? 'pos' : this.adjustment < 0 ? 'neg' : '',
      hasSelection: this.selected.size > 0,
      result:       this.result,
    };
  }

  _tallyBreakdown() {
    let tagPower = 0, bestPos = 0, worstNeg = 0;
    let bestPosName = null, worstNegName = null;
    const entries = [];

    for (const [, entry] of this.selected) {
      if (entry.tag.kind === 'status') {
        const tier = entry.tag.tier;
        if (entry.polarity === 'positive') {
          if (tier > bestPos) { bestPos = tier; bestPosName = entry.tag.name; }
        } else {
          if (tier > worstNeg) { worstNeg = tier; worstNegName = entry.tag.name; }
        }
      } else {
        const val = entry.polarity === 'burned' ? 3 : entry.polarity === 'positive' ? 1 : -1;
        tagPower += val;
        const lbl = entry.polarity === 'burned' ? '+3' : val > 0 ? '+1' : '−1';
        entries.push({ name: entry.tag.name, value: val, label: lbl, isPositive: val > 0, burned: entry.polarity === 'burned', source: entry.tag.source, kind: entry.tag.kind });
      }
    }

    if (bestPos  > 0) entries.push({ name: bestPosName,  value:  bestPos,  label: `+${bestPos}`,  isPositive: true,  source: 'Statuses', kind: 'status' });
    if (worstNeg > 0) entries.push({ name: worstNegName, value: -worstNeg, label: `−${worstNeg}`, isPositive: false, source: 'Statuses', kind: 'status' });

    return { tagPower, bestPos, worstNeg, entries };
  }

  /* ── Event listeners ────────────────────────────── */

  _attachListeners() {
    const el = this.element;
    if (!el) return;

    for (const tag of el.querySelectorAll('.rp-tag[data-tag-id]'))
      tag.addEventListener('click', () => this._cycleTag(tag.dataset.tagId));

    el.querySelector('.rp-roll-btn')?.addEventListener('click',  () => this.executeRoll());
    el.querySelector('.rp-close-btn')?.addEventListener('click', () => this.close());
    el.querySelector('.rp-adj-inc')?.addEventListener('click', () => { this.adjustment++; this.render(); });
    el.querySelector('.rp-adj-dec')?.addEventListener('click', () => { this.adjustment--; this.render(); });
  }

  _cycleTag(id) {
    const tag = this._findTag(id);
    if (!tag) return;
    const sel = this.selected.get(id);

    if (!sel) {
      // First click: select (weakness starts negative, others positive)
      this.selected.set(id, { tag, polarity: tag.kind === 'weakness' ? 'negative' : 'positive' });
    } else if (tag.kind === 'weakness') {
      // Weakness: negative → deselect
      this.selected.delete(id);
    } else if (tag.kind === 'status') {
      // Status: positive → negative → deselect
      if (sel.polarity === 'positive') sel.polarity = 'negative';
      else this.selected.delete(id);
    } else {
      // Power tag: positive → burned (+3, will scratch) → deselect
      if (sel.polarity === 'positive') sel.polarity = 'burned';
      else this.selected.delete(id);
    }

    this.result = null;
    this.render();
  }

  _findTag(id) {
    for (const group of this._buildTagPool()) {
      const found = group.tags.find(t => t.id === id);
      if (found) return found;
    }
    return null;
  }

  /* ── Roll execution ─────────────────────────────── */

  async executeRoll() {
    const { tagPower, bestPos, worstNeg, entries } = this._tallyBreakdown();
    const power = tagPower + bestPos - worstNeg + this.adjustment;

    const roll = await new Roll('2d6').evaluate();
    const [d1, d2] = roll.dice[0].results.map(r => r.result);
    const total    = d1 + d2 + power;

    const doubleOnes  = d1 === 1 && d2 === 1;
    const doubleSixes = d1 === 6 && d2 === 6;

    let outcome, band;
    if      (doubleOnes)  { outcome = 'Consequences Only';            band = 'special-miss';    }
    else if (doubleSixes) { outcome = '✦ Double Sixes — Full Success'; band = 'special-success'; }
    else if (total >= 10) { outcome = 'Full Success';                  band = 'success';         }
    else if (total >= 7)  { outcome = 'Success with Consequences';     band = 'partial';         }
    else                  { outcome = 'Consequences Only';             band = 'miss';            }

    // Collect weakness sources before _markWeaknessImprove clears state
    const weaknessSources = new Set();
    for (const [, entry] of this.selected) {
      if (entry.tag.kind === 'weakness') weaknessSources.add(entry.tag.source);
    }

    await this._markWeaknessImprove();
    await this._scratchBurnedTags();
    await this._scratchFellowshipTags();

    // Group entries by source, attach weakness improve notes
    const tagGroups = [];
    const sourceMap = new Map();
    for (const entry of entries) {
      const src = entry.source || 'Other';
      if (!sourceMap.has(src)) {
        const group = { source: src, entries: [], weaknessNote: null };
        sourceMap.set(src, group);
        tagGroups.push(group);
      }
      sourceMap.get(src).entries.push(entry);
    }
    for (const src of weaknessSources) {
      const group = sourceMap.get(src);
      if (group) group.weaknessNote = `Marked improve on ${src}`;
    }

    const TYPE_LABELS = { quick: 'Quick Roll', detailed: 'Detailed Roll', reaction: 'Reaction Roll' };
    const chatContent = await renderTemplate(CARD_TEMPLATE, {
      actorName:      this.actor.name,
      rollTypeLabel:  TYPE_LABELS[this.rollType] ?? '',
      tagGroups,
      hasEntries:     entries.length > 0,
      d1, d2, power, total, outcome, band,
      isDoubleSixes:  doubleSixes,
      breakdownStr:   (() => {
        const sign = power > 0 ? `+ ${power}` : power < 0 ? `− ${Math.abs(power)}` : null;
        return sign ? `${d1} + ${d2} ${sign} = ${total}` : `${d1} + ${d2} = ${total}`;
      })(),
      showSpendPower: this.rollType === 'detailed' && band !== 'miss' && band !== 'special-miss',
      spendPower:     Math.max(1, power),
      isReaction:     this.rollType === 'reaction',
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent,
      rolls:   [roll],
    });

    this.close();
  }

  async _scratchBurnedTags() {
    const themes  = foundry.utils.deepClone(this.actor.system.themes);
    let changed   = false;

    for (const [, entry] of this.selected) {
      if (entry.polarity !== 'burned') continue;
      for (const theme of themes) {
        const pt = theme.powerTags.find(t => t.id === entry.tag.id);
        if (pt) { pt.scratched = true; changed = true; break; }
      }
    }

    if (changed) await this.actor.update({ 'system.themes': themes });
  }

  async _scratchFellowshipTags() {
    const fellowship = game.actors.get(this.actor.system.fellowshipId);
    if (!fellowship) return;

    const fs      = foundry.utils.deepClone(fellowship.system);
    let   changed = false;

    for (const [id] of this.selected) {
      if (!id.startsWith('f-')) continue;
      if (id === 'f-title') {
        fs.titleTag.scratched = true;
        changed = true;
      } else {
        const rawId = id.slice(2);
        const pt = (fs.powerTags    || []).find(t => t.id === rawId);
        const wt = (fs.weaknessTags || []).find(t => t.id === rawId);
        if (pt) { pt.scratched = true; changed = true; }
        if (wt) {
          wt.scratched = true;
          fs.improveCount = Math.min(5, (fs.improveCount ?? 0) + 1);
          changed = true;
        }
      }
    }

    if (changed) await fellowship.update({
      'system.titleTag':     fs.titleTag,
      'system.powerTags':    fs.powerTags,
      'system.weaknessTags': fs.weaknessTags,
      'system.improveCount': fs.improveCount,
    });
  }

  async _markWeaknessImprove() {
    const themes  = foundry.utils.deepClone(this.actor.system.themes);
    let changed   = false;

    for (const [, entry] of this.selected) {
      if (entry.tag.kind !== 'weakness') continue;
      for (const theme of themes) {
        const wt = theme.weaknessTags.find(t => t.id === entry.tag.id);
        if (wt && theme.improveCount < 3) {
          theme.improveCount = Math.min(3, theme.improveCount + 1);
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      await this.actor.update({ 'system.themes': themes });
      ui.notifications.info('Marked improve on theme for weakness tag used in roll.');
    }
  }
}
