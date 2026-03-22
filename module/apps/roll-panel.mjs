const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PANEL_TEMPLATE = 'systems/legend-in-the-mist-foundry/templates/partials/roll-panel.hbs';
const CARD_TEMPLATE  = 'systems/legend-in-the-mist-foundry/templates/chat/roll-card.hbs';

const SACRIFICE_INFO = {
  painful: { label: 'Painful',  consequence: 'Scratch all tags in a relevant theme (one tag if lessened)' },
  scarring: { label: 'Scarring', consequence: 'Replace a relevant theme' },
  grave:    { label: 'Grave',    consequence: 'Take a tier-6 status without lessening' },
};

const MIGHT_LABELS = {
  '-6': 'Extremely Imperiled',
  '-3': 'Imperiled',
   '3': 'Favored',
   '6': 'Extremely Favored',
};

export class RollPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static activeInstance = null;

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
    this.isOpen          = false;
    this.rollType        = null;
    this.selected        = new Map();
    this.result          = null;
    this.adjustment      = 0;
    this._rollId         = null;
    this._gmContributions = [];
    this._tradePower     = null;   // null | 'throwCaution' | 'hedgeRisks'
    this._sacrificeLevel = null;   // null | 'painful' | 'scarring' | 'grave'
    this._might          = 0;      // -6 | -3 | 0 | 3 | 6
  }

  get title() {
    const TYPE_LABELS = { quick: 'Quick Roll', detailed: 'Detailed Roll', reaction: 'Reaction Roll', sacrifice: 'Sacrifice Roll' };
    return TYPE_LABELS[this.rollType] ?? 'Roll';
  }

  /* ── Public API ─────────────────────────────────── */

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.isOpen           = true;
      this.rollType         = 'quick';
      this.selected.clear();
      this.result           = null;
      this.adjustment       = 0;
      this._tradePower      = null;
      this._sacrificeLevel  = null;
      this._might           = 0;
      this._rollId          = foundry.utils.randomID();
      this._gmContributions = [];
      RollPanel.activeInstance = this;
      const rollStartData = { type: 'rollStart', rollId: this._rollId, actorName: this.actor.name };
      game.socket.emit('system.legend-in-the-mist-foundry', rollStartData);
      game.litm?.sceneTracker?.instance?._onRollStart(rollStartData);
      this.render({ force: true });
    }
    this._syncButtons();
  }

  _setRollType(type) {
    this.rollType        = type;
    this.result          = null;
    this._tradePower     = null;
    this._sacrificeLevel = null;
    this._might          = 0;
    this.render();
  }

  async close(options = {}) {
    RollPanel.activeInstance = null;
    if (this._rollId) {
      const rollEndData = { type: 'rollEnd', rollId: this._rollId };
      game.socket.emit('system.legend-in-the-mist-foundry', rollEndData);
      game.litm?.sceneTracker?.instance?._onRollEnd(rollEndData);
      this._rollId = null;
    }
    this.isOpen           = false;
    this.rollType         = null;
    this.selected.clear();
    this.result           = null;
    this._gmContributions = [];
    this._tradePower      = null;
    this._sacrificeLevel  = null;
    this._might           = 0;
    this._syncButtons();
    return super.close(options);
  }

  /** Called from hero sheet _onRender — keeps roll buttons in sync. */
  restore() {
    this._syncButtons();
  }

  /** Receives GM contribution updates from the scene tracker via socket. */
  _onGmContributions({ rollId, contributions }) {
    if (rollId !== this._rollId) return;
    this._gmContributions = contributions;
    this.render();
  }

  /* ── Rendering ──────────────────────────────────── */

  async _prepareContext(options) {
    return this._buildContext();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._attachListeners();
    if (this._preservePoolScroll != null) {
      const pool = this.element?.querySelector('.rp-pool');
      if (pool) pool.scrollTop = this._preservePoolScroll;
      this._preservePoolScroll = null;
    }
  }

  _syncButtons() {
    if (!this.sheet.element) return;
    const btn = this.sheet.element.querySelector('.roll-btn');
    if (btn) btn.classList.toggle('active', this.isOpen);
  }

  /* ── Context ────────────────────────────────────── */

  _buildTagPool() {
    const sys    = this.actor.system;
    const groups = [];

    // Themes
    for (const theme of sys.themes) {
      const themeName = theme.name || 'Theme';
      const tags = [];
      if (theme.name && !theme.titleScratched)
        tags.push({ id: `title-${theme.id}`, name: theme.name, kind: 'power', source: themeName });
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
          tags.push({ id: 'f-title', name: fs.titleTag.name, kind: 'fellowship', source: 'Fellowship' });
        for (const t of (fs.powerTags   || []).filter(t => !t.scratched))
          tags.push({ id: `f-${t.id}`, name: t.name, kind: 'fellowship', source: 'Fellowship' });
        for (const t of (fs.weaknessTags || []).filter(t => !t.scratched))
          tags.push({ id: `f-${t.id}`, name: t.name, kind: 'weakness', source: 'Fellowship' });
        if (tags.length) groups.push({ label: 'Fellowship', tags });
      }
    }

    // Story Themes
    for (const theme of (sys.storyThemes ?? [])) {
      const themeName = theme.name || 'Story Theme';
      const tags = [];
      if (theme.name && !theme.titleScratched)
        tags.push({ id: `st-title-${theme.id}`, name: theme.name, kind: 'power', source: themeName });
      for (const t of theme.powerTags.filter(t => !t.scratched))
        tags.push({ id: `st-${t.id}`, name: t.name, kind: 'power', source: themeName });
      for (const t of theme.weaknessTags.filter(t => !t.scratched))
        tags.push({ id: `st-${t.id}`, name: t.name, kind: 'weakness', source: themeName });
      if (tags.length) groups.push({ label: themeName, tags });
    }

    // Relationships
    const rels = (sys.relationshipTags || []).filter(r => r.tag);
    if (rels.length)
      groups.push({ label: 'Relationships', tags: rels.map(r => ({ id: r.id, name: r.tag, kind: 'relationship', source: 'Relationships' })) });

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
    const isSacrifice = this.rollType === 'sacrifice';

    // Add GM contributions as a read-only Scene group
    if (this._gmContributions.length) {
      const gmTags = this._gmContributions.map(c => ({
        id:          `gm-${c.id}`,
        name:        c.name,
        kind:        c.kind === 'status' ? 'status' : c.kind === 'storyThemeWeaknessTag' ? 'weakness' : 'power',
        tier:        c.tier,
        source:      c.source,
        isSelected:  true,
        isNegative:  c.polarity === 'negative',
        isBurned:    false,
        isGmContrib: true,
      }));
      groups.push({ label: 'Story Themes', tags: gmTags });
    }

    for (const group of groups) {
      for (const tag of group.tags) {
        if (tag.isGmContrib) continue;
        const sel      = this.selected.get(tag.id);
        tag.isSelected = !!sel;
        tag.isNegative = sel?.polarity === 'negative';
        tag.isBurned   = sel?.polarity === 'burned';
      }
    }

    // Mark non-interactive tags (sacrifice reference or GM contributions)
    for (const group of groups) {
      for (const tag of group.tags) {
        tag.noInteraction = tag.isGmContrib || isSacrifice;
      }
    }

    const { tagPower, bestPos, worstNeg, entries } = this._tallyBreakdown();
    const basePower = tagPower + bestPos - worstNeg + this.adjustment;

    // Auto-clear trade selection if the power threshold no longer qualifies
    if (this._tradePower === 'throwCaution' && basePower > 2) this._tradePower = null;
    if (this._tradePower === 'hedgeRisks'   && basePower < 2) this._tradePower = null;

    let tradeDelta = 0;
    if (!isSacrifice) {
      if (this._tradePower === 'throwCaution') tradeDelta = -1;
      else if (this._tradePower === 'hedgeRisks') tradeDelta = 1;
    }
    const power = isSacrifice ? this.adjustment : basePower + tradeDelta;

    return {
      rollType:     this.rollType,
      groups,
      entries,
      power,
      powerLabel:   power > 0 ? `+${power}` : `${power}`,
      powerClass:   power > 0 ? 'pos' : power < 0 ? 'neg' : '',
      adjustLabel:  this.adjustment > 0 ? `+${this.adjustment}` : `${this.adjustment}`,
      adjustClass:  this.adjustment > 0 ? 'pos' : this.adjustment < 0 ? 'neg' : '',
      hasSelection: this.selected.size > 0 || this._gmContributions.length > 0,
      result:       this.result,
      // Roll enablement
      rollEnabled:  isSacrifice ? !!this._sacrificeLevel : !!this.rollType,
      // Trade Power (Detailed only)
      showTradeOptions: this.rollType === 'detailed' && !this.result,
      tradePower:       this._tradePower,
      throwCautionOk:   basePower <= 2,
      hedgeRisksOk:     basePower >= 2,
      // Sacrifice
      isSacrifice,
      sacrificeLevel:       this._sacrificeLevel,
      sacrificeConsequence: this._sacrificeLevel ? SACRIFICE_INFO[this._sacrificeLevel].consequence : null,
      // Might
      might: this._might,
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
        const burned = entry.polarity === 'burned';
        entries.push({ tagId: entry.tag.id, name: entry.tag.name, value: val, label: lbl, isPositive: val > 0, burned, burnable: !burned && entry.tag.kind === 'power', source: entry.tag.source, kind: entry.tag.kind });
      }
    }

    // Include GM contributions in tally
    for (const contrib of this._gmContributions) {
      if (contrib.kind === 'status') {
        const tier = contrib.tier;
        if (contrib.polarity === 'positive') {
          if (tier > bestPos) { bestPos = tier; bestPosName = contrib.name; }
        } else {
          if (tier > worstNeg) { worstNeg = tier; worstNegName = contrib.name; }
        }
      } else {
        const val = contrib.polarity === 'positive' ? 1 : -1;
        tagPower += val;
        const lbl = val > 0 ? '+1' : '−1';
        entries.push({ name: contrib.name, value: val, label: lbl, isPositive: val > 0, burned: false, burnable: false, source: contrib.source, kind: contrib.kind, isGmContrib: true });
      }
    }

    // Might entry (not in sacrifice mode)
    if (this._might !== 0 && this.rollType !== 'sacrifice') {
      const mightLabel = MIGHT_LABELS[String(this._might)] ?? '';
      tagPower += this._might;
      entries.push({
        name:      mightLabel,
        value:     this._might,
        label:     this._might > 0 ? `+${this._might}` : `${this._might}`,
        isPositive: this._might > 0,
        burned:    false,
        burnable:  false,
        source:    'Might',
        kind:      'might',
      });
    }

    if (bestPos  > 0) entries.push({ name: bestPosName,  value:  bestPos,  label: `+${bestPos}`,  isPositive: true,  source: 'Statuses', kind: 'status' });
    if (worstNeg > 0) entries.push({ name: worstNegName, value: -worstNeg, label: `−${worstNeg}`, isPositive: false, source: 'Statuses', kind: 'status' });

    return { tagPower, bestPos, worstNeg, entries };
  }

  /* ── Event listeners ────────────────────────────── */

  _attachListeners() {
    const el = this.element;
    if (!el) return;

    for (const tag of el.querySelectorAll('.rp-tag[data-tag-id]')) {
      tag.addEventListener('click', () => this._cycleTag(tag.dataset.tagId));
      tag.addEventListener('contextmenu', ev => { ev.preventDefault(); this._burnTag(tag.dataset.tagId); });
    }

    for (const btn of el.querySelectorAll('.rp-type-btn'))
      btn.addEventListener('click', () => this._setRollType(btn.dataset.rollType));

    el.querySelector('.rp-roll-btn')?.addEventListener('click',  () => this.executeRoll());
    el.querySelector('.rp-close-btn')?.addEventListener('click', () => this.close());
    el.querySelector('.rp-adj-inc')?.addEventListener('click', () => { this.adjustment++; this.render(); });
    el.querySelector('.rp-adj-dec')?.addEventListener('click', () => { this.adjustment--; this.render(); });

    // Trade Power buttons
    for (const btn of el.querySelectorAll('.rp-trade-btn[data-trade]'))
      btn.addEventListener('click', () => {
        const trade = btn.dataset.trade;
        this._tradePower = this._tradePower === trade ? null : trade;
        this.render();
      });

    // Sacrifice level buttons
    for (const btn of el.querySelectorAll('.rp-sac-btn[data-sacrifice]'))
      btn.addEventListener('click', () => {
        const level = btn.dataset.sacrifice;
        this._sacrificeLevel = this._sacrificeLevel === level ? null : level;
        this.render();
      });

    // Might buttons
    for (const btn of el.querySelectorAll('.rp-might-btn[data-might]'))
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.might, 10);
        this._might = this._might === val ? 0 : val;
        this.render();
      });
  }

  _cycleTag(id) {
    if (this.rollType === 'sacrifice') return;
    const tag = this._findTag(id);
    if (!tag) return;
    const sel = this.selected.get(id);

    if (!sel) {
      this.selected.set(id, { tag, polarity: tag.kind === 'weakness' ? 'negative' : 'positive' });
    } else if (tag.kind === 'status') {
      if (sel.polarity === 'positive') sel.polarity = 'negative';
      else this.selected.delete(id);
    } else {
      this.selected.delete(id);
    }

    this._tradePower = null;
    this.result = null;
    this._preservePoolScroll = this.element?.querySelector('.rp-pool')?.scrollTop ?? null;
    this.render();
  }

  _burnTag(id) {
    if (this.rollType === 'sacrifice') return;
    const tag = this._findTag(id);
    if (!tag || tag.kind !== 'power') return;
    this.selected.set(id, { tag, polarity: 'burned' });
    this._tradePower = null;
    this.result = null;
    this._preservePoolScroll = this.element?.querySelector('.rp-pool')?.scrollTop ?? null;
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
    const isSacrifice = this.rollType === 'sacrifice';
    if (isSacrifice && !this._sacrificeLevel) return;

    const { tagPower, bestPos, worstNeg, entries } = this._tallyBreakdown();
    const basePower = tagPower + bestPos - worstNeg + this.adjustment;

    let rollPower, spendPower;
    if (isSacrifice) {
      rollPower  = this.adjustment;
      spendPower = 0;
    } else if (this._tradePower === 'throwCaution') {
      rollPower  = basePower - 1;
      spendPower = Math.max(1, basePower + 1);
    } else if (this._tradePower === 'hedgeRisks') {
      rollPower  = basePower + 1;
      spendPower = Math.max(1, basePower - 1);
    } else {
      rollPower  = basePower;
      spendPower = Math.max(1, basePower);
    }

    const roll = await new Roll('2d6').evaluate();
    const [d1, d2] = roll.dice[0].results.map(r => r.result);
    const total    = d1 + d2 + rollPower;

    const doubleOnes  = !isSacrifice && d1 === 1 && d2 === 1;
    const doubleSixes = !isSacrifice && d1 === 6 && d2 === 6;

    let outcome, band;
    if (isSacrifice) {
      if      (total >= 10) { outcome = game.i18n.localize('LITM.Roll.Miracle'); band = 'success'; }
      else if (total >= 7)  { outcome = game.i18n.localize('LITM.Roll.Fate');    band = 'partial'; }
      else                  { outcome = game.i18n.localize('LITM.Roll.InVain');  band = 'miss';    }
    } else {
      if      (doubleOnes)  { outcome = game.i18n.localize('LITM.Roll.DoubleOnes');          band = 'special-miss';    }
      else if (doubleSixes) { outcome = '✦ ' + game.i18n.localize('LITM.Roll.DoubleSixes'); band = 'special-success'; }
      else if (total >= 10) { outcome = game.i18n.localize('LITM.Roll.FullSuccess');         band = 'success';         }
      else if (total >= 7)  { outcome = game.i18n.localize('LITM.Roll.SuccessConsequences'); band = 'partial';         }
      else                  { outcome = game.i18n.localize('LITM.Roll.ConsequencesOnly');    band = 'miss';            }
    }

    // Side effects (skip for sacrifice)
    const weaknessSources = new Set();
    if (!isSacrifice) {
      for (const [, entry] of this.selected) {
        if (entry.tag.kind === 'weakness') weaknessSources.add(entry.tag.source);
      }
      await this._markWeaknessImprove();
      await this._scratchBurnedTags();
      await this._scratchFellowshipTags();
    }

    // Group entries by source for chat card
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

    const TYPE_LABELS = { quick: 'Quick Roll', detailed: 'Detailed Roll', reaction: 'Reaction Roll', sacrifice: 'Sacrifice Roll' };
    const chatContent = await renderTemplate(CARD_TEMPLATE, {
      actorName:      this.actor.name,
      rollTypeLabel:  TYPE_LABELS[this.rollType] ?? '',
      tagGroups,
      hasEntries:     !isSacrifice && entries.length > 0,
      d1, d2,
      power:          rollPower,
      powerLabel:     rollPower > 0 ? `+${rollPower}` : `${rollPower}`,
      total, outcome, band,
      isDoubleSixes:  doubleSixes,
      breakdownStr:   rollPower !== 0 ? `${rollPower > 0 ? '+' : '−'}${Math.abs(rollPower)} power` : null,
      showSpendPower: !isSacrifice && this.rollType === 'detailed' && band !== 'miss' && band !== 'special-miss',
      spendPower,
      isReaction:     this.rollType === 'reaction',
      tradePower:     this._tradePower,
      isSacrifice,
      sacrificeLabel:       isSacrifice ? SACRIFICE_INFO[this._sacrificeLevel]?.label       : null,
      sacrificeConsequence: isSacrifice ? SACRIFICE_INFO[this._sacrificeLevel]?.consequence : null,
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
