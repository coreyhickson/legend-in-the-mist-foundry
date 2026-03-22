const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = "legend-in-the-mist-foundry";

const TAB_LABELS = {
  question:        "Question",
  conflict:        "Conflict",
  vignettes:       "Vignettes",
  premadeProfile:  "Premade Profile",
  challengeAction: "Challenge Action",
  consequence:     "Consequence",
  revelations:     "Revelations",
};

const ROLL_LABELS = {
  question:        "Roll Interpretive Oracle",
  conflict:        "Roll Conflict Oracle",
  vignettes:       "Roll d6",
  challengeAction: "Roll d6",
  consequence:     "Roll Consequence",
  revelations:     "Roll Revelation",
  premadeProfile:  "Roll Profile",
};

export class LitmOracle extends HandlebarsApplicationMixin(ApplicationV2) {

  static instance = null;

  _oracleMode        = "roll-all";
  _challengeRole     = "";
  _vignetteCategory  = "";
  _revelationAct     = "0";
  _profileCategory   = "";

  static DEFAULT_OPTIONS = {
    id: "litm-oracle",
    classes: ["litm", "oracle"],
    position: { width: 380, height: 560 },
    window: { resizable: true, title: "Oracle" },
    actions: {
      roll:             LitmOracle._roll,
      rollInterpretive: LitmOracle._rollInterpretive,
      rollPerColumn:         LitmOracle._rollPerColumn,
      rollVignette:          LitmOracle._rollVignette,
      rollPremadeProfile:    LitmOracle._rollPremadeProfile,
      rollChallengeAction:   LitmOracle._rollChallengeAction,
      rollConsequence:       LitmOracle._rollConsequence,
      rollRevelation:        LitmOracle._rollRevelation,
      importData:       LitmOracle._importData,
      exportData:       LitmOracle._exportData,
      showHelp:         LitmOracle._showHelp,
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/legend-in-the-mist-foundry/templates/apps/oracle.hbs",
      scrollY: [".oracle-body"]
    }
  };

  /* ─── Singleton ──────────────────────────────────────────── */

  static open() {
    if (!LitmOracle.instance) LitmOracle.instance = new LitmOracle();
    if (LitmOracle.instance.rendered) return LitmOracle.instance.close();
    LitmOracle.instance.render(true);
    return LitmOracle.instance;
  }

  async close(options) {
    LitmOracle.instance = null;
    return super.close(options);
  }

  /* ─── Context ────────────────────────────────────────────── */

  async _prepareContext() {
    const data = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const tableHasData = t => t.rolls && Object.values(t.rolls).some(row => row?.some(v => v));

    const oracles = Object.entries(TAB_LABELS).map(([key, label]) => {
      const oracleData = data[key] ?? {};
      const tables     = oracleData.tables ?? [];
      const hasData    = tables.some(tableHasData);

      let filteredTables = tables;
      if (key === "challengeAction") {
        filteredTables = tables.filter(tableHasData);
        if (filteredTables.length && !this._challengeRole) {
          this._challengeRole = filteredTables[0].key;
        }
      } else if (key === "vignettes") {
        filteredTables = tables.filter(tableHasData);
        if (filteredTables.length && !this._vignetteCategory) {
          this._vignetteCategory = filteredTables[0].key;
        }
      }

      // For premadeProfile, extract category list from D66 table rows (col 0 = category name)
      let categories = [];
      if (key === "premadeProfile") {
        const table = filteredTables[0];
        if (table?.rolls) {
          categories = Object.entries(table.rolls)
            .map(([rangeKey, row]) => ({
              key:   rangeKey,
              label: Array.isArray(row) && typeof row[0] === "string" ? row[0] : rangeKey,
            }))
            .filter(c => c.label);
        }
      }

      return {
        key,
        label,
        hasData,
        rollLabel:  ROLL_LABELS[key] ?? "Roll Oracle",
        tables:     filteredTables,
        categories,
      };
    });

    return {
      oracles,
      isGM: game.user.isGM,
    };
  }

  /* ─── Rolling ────────────────────────────────────────────── */

  static _rollD66() {
    const tens  = Math.floor(Math.random() * 6) + 1;
    const units = Math.floor(Math.random() * 6) + 1;
    return { tens, units, key: `${tens}${units}` };
  }

  // Supports both exact keys ("42") and range keys ("41-43")
  static _lookupRoll(rolls, key) {
    if (rolls[key] !== undefined) return rolls[key];
    const num = parseInt(key);
    for (const [rangeKey, value] of Object.entries(rolls)) {
      if (!rangeKey.includes("-")) continue;
      const [start, end] = rangeKey.split("-").map(Number);
      if (num >= start && num <= end) return value;
    }
    return [];
  }

  static async _roll(event, target) {
    const tab      = this._activeTab;
    const tableKey = target.dataset.tableKey;
    const data     = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle   = data[tab];

    if (!oracle?.tables) return;
    const table = oracle.tables.find(t => t.key === tableKey);
    if (!table?.rolls) return;

    const diceType = table.diceType ?? "d66";
    let roll, key;

    if (diceType === "d6") {
      const result = Math.ceil(CONFIG.Dice.randomUniform() * 6);
      roll = { type: "d6", result, key: String(result) };
      key  = String(result);
    } else {
      const { tens, units } = LitmOracle._rollD66();
      roll = { type: "d66", tens, units, key: `${tens}${units}` };
      key  = `${tens}${units}`;
    }

    const values = LitmOracle._lookupRoll(table.rolls, key);

    // Build chat content
    const tabLabel   = TAB_LABELS[tab] ?? tab;
    const subLabel   = table.label ? ` — ${table.label}` : "";
    const rollStr    = roll.type === "d66"
      ? `${roll.tens} and ${roll.units} → <strong>${roll.key}</strong>`
      : `Rolled <strong>${roll.result}</strong>`;

    const colsHtml = table.columns.map((col, i) => {
      const val = values[i];
      if (typeof val === "string" && /roll again twice/i.test(val)) {
        const entries = [
          { rollLabel: null, val },
          ...LitmOracle._resolveEntries(table, i),
          ...LitmOracle._resolveEntries(table, i),
        ];
        return LitmOracle._renderColGroup(col, entries);
      }
      return LitmOracle._colHtml(col, val);
    }).join("");

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: ${tabLabel}${subLabel}</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  /* ─── Interpretive Oracle (Question tab) ────────────────── */

  static async _rollInterpretive(event, target) {
    const mode   = this._oracleMode ?? "roll-all";
    const data   = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.question;
    if (!oracle?.tables) return;

    const table0 = oracle.tables[0] ?? null;
    const table1 = oracle.tables[1] ?? null;

    // Support both layouts:
    //   2-table: table0 = [Symbol, Interpretations], table1 = [Attitude, Magical Being, Terrain, Item]
    //   1-table: table0 = [Symbol, Interpretations, Attitude, Magical Being, Terrain, Item]
    const detailTable  = table1 ?? table0;
    const detailOffset = table1 ? 0 : 2;   // detail cols start at 2 when in a single table
    const DETAIL_IDX   = { attitude: 0, "magical-being": 1, terrain: 2, item: 3 };

    let colsHtml = "";
    let rollStr  = "Mixed roll";

    const symLabel = table0?.label || "Symbol & Interpretation";

    if (mode === "roll-all") {
      // Symbol group: first 2 cols of table0 share one roll, rendered as one grouped entry
      const symHtml = (() => {
        if (!table0) return "";
        const { tens, units, key } = LitmOracle._rollD66();
        const row = LitmOracle._lookupRoll(table0.rolls, key);
        const cols = (table0.columns ?? []).slice(0, 2);
        return LitmOracle._renderColGroup(symLabel, cols.map((_, i) => ({
          rollLabel: i === 0 ? `${tens},${units}` : null,
          val: row[i],
        })));
      })();
      // Detail cols: each rolls independently via flatMap
      const detailHtml = oracle.tables.flatMap((table, tIdx) =>
        (table.columns ?? []).slice(tIdx === 0 ? 2 : 0).map((col, relIdx) => {
          const absIdx = (tIdx === 0 ? 2 : 0) + relIdx;
          const { tens, units, key } = LitmOracle._rollD66();
          const val = LitmOracle._lookupRoll(table.rolls, key);
          return LitmOracle._colHtml(col, val[absIdx], `${tens},${units}`);
        })
      ).join("");
      colsHtml = symHtml + detailHtml;

    } else if (mode === "all") {
      const { tens, units, key } = LitmOracle._rollD66();
      rollStr  = `${tens} and ${units} → <strong>${key}</strong>`;
      // Symbol group first, then detail cols
      const symCols = table0 ? (table0.columns ?? []).slice(0, 2) : [];
      const symRow  = table0 ? LitmOracle._lookupRoll(table0.rolls, key) : [];
      const symHtml = symCols.length
        ? LitmOracle._renderColGroup(symLabel, symCols.map((_, i) => ({ rollLabel: null, val: symRow[i] })))
        : "";
      const detailHtml = oracle.tables.flatMap((table, tIdx) => {
        const row  = LitmOracle._lookupRoll(table.rolls, key);
        return (table.columns ?? []).slice(tIdx === 0 ? 2 : 0).map((col, relIdx) => {
          const absIdx = (tIdx === 0 ? 2 : 0) + relIdx;
          return LitmOracle._colHtml(col, row[absIdx]);
        });
      }).join("");
      colsHtml = symHtml + detailHtml;

    } else if (mode === "symbols") {
      if (table0) {
        const { tens, units, key } = LitmOracle._rollD66();
        rollStr  = `${tens} and ${units} → <strong>${key}</strong>`;
        const row  = LitmOracle._lookupRoll(table0.rolls, key);
        const cols = (table0.columns ?? []).slice(0, 2);
        colsHtml = LitmOracle._renderColGroup(symLabel, cols.map((_, i) => ({ rollLabel: null, val: row[i] })));
      }

    } else {
      // Single detail column — works whether details are in table1 or table0 cols 2+
      const relIdx = DETAIL_IDX[mode] ?? 0;
      const absIdx = relIdx + detailOffset;
      if (detailTable) {
        const { tens, units, key } = LitmOracle._rollD66();
        rollStr  = `${tens} and ${units} → <strong>${key}</strong>`;
        const row = LitmOracle._lookupRoll(detailTable.rolls, key);
        const col = (detailTable.columns ?? [])[absIdx] ?? mode;
        colsHtml  = LitmOracle._colHtml(col, row[absIdx]);
      }
    }

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Interpretive</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  // Rolls one independent d66 per column across all tables, combines into one chat message
  static async _rollPerColumn(event, target) {
    const data   = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.conflict;
    if (!oracle?.tables) return;

    const colsHtml = oracle.tables.flatMap(table =>
      (table.columns ?? []).map((col, i) =>
        LitmOracle._renderColGroup(col, LitmOracle._resolveEntries(table, i))
      )
    ).join("");

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Conflict</div>
            <div class="oracle-chat-roll">Mixed roll</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  static async _rollChallengeAction(event, target) {
    const tableKey = this._challengeRole;
    if (!tableKey) return;
    const data  = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.challengeAction;
    if (!oracle?.tables) return;
    const table = oracle.tables.find(t => t.key === tableKey);
    if (!table?.rolls) return;

    const result  = Math.ceil(Math.random() * 6);
    const key     = String(result);
    const values  = LitmOracle._lookupRoll(table.rolls, key);
    const rollStr = `Rolled <strong>${result}</strong>`;
    const colsHtml = (table.columns ?? []).map((col, i) => LitmOracle._colHtml(col, values[i])).join("");

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Challenge Action — ${table.label}</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  static async _rollVignette(event, target) {
    const tableKey = this._vignetteCategory;
    if (!tableKey) return;
    const data   = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.vignettes;
    if (!oracle?.tables) return;
    const table = oracle.tables.find(t => t.key === tableKey);
    if (!table?.rolls) return;

    const result  = Math.ceil(Math.random() * 6);
    const key     = String(result);
    const values  = LitmOracle._lookupRoll(table.rolls, key);
    const rollStr = `Rolled <strong>${result}</strong>`;
    const colsHtml = (table.columns ?? []).map((col, i) => LitmOracle._colHtml(col, values[i])).join("");

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Vignette — ${table.label}</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  static async _rollConsequence(event, target) {
    const data  = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.consequence;
    if (!oracle?.tables) return;
    const table = oracle.tables[0];
    if (!table?.rolls) return;

    const { tens, units, key } = LitmOracle._rollD66();
    const row         = LitmOracle._lookupRoll(table.rolls, key) ?? [];
    const consequence = row[0];
    const d6          = Math.ceil(Math.random() * 6);
    const specific    = row[d6]; // row[1]–row[6] map to d6 results 1–6
    const rollStr     = `${tens} and ${units} → <strong>${key}</strong>`;

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Consequence</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">
            ${LitmOracle._colHtml("Consequence", consequence)}
            ${LitmOracle._colHtml("Specific Consequence", specific)}
          </div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  static async _rollRevelation(event, target) {
    const data  = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.revelations;
    if (!oracle?.tables) return;
    const table = oracle.tables[0];
    if (!table?.rolls) return;

    const actIdx  = parseInt(this._revelationAct ?? "0");
    const actLabel = (table.columns ?? [])[actIdx] ?? `Act ${actIdx + 1}`;

    const { tens, units, key } = LitmOracle._rollD66();
    const row     = LitmOracle._lookupRoll(table.rolls, key) ?? [];
    const rollStr = `${tens} and ${units} → <strong>${key}</strong>`;

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Revelation — ${actLabel}</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">
            ${LitmOracle._colHtml(actLabel, row[actIdx])}
          </div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  static async _rollPremadeProfile(event, target) {
    const data   = game.settings.get(SYSTEM_ID, "oracleData") ?? {};
    const oracle = data.premadeProfile;
    if (!oracle?.tables) return;
    const table = oracle.tables[0];
    if (!table?.rolls) return;

    let row, rollStr;

    if (this._profileCategory) {
      row     = LitmOracle._lookupRoll(table.rolls, this._profileCategory);
      rollStr = `Category: <strong>${Array.isArray(row) && typeof row[0] === "string" ? row[0] : this._profileCategory}</strong>`;
    } else {
      const { tens, units, key } = LitmOracle._rollD66();
      row     = LitmOracle._lookupRoll(table.rolls, key);
      rollStr = `${tens} and ${units} → <strong>${key}</strong>`;
    }

    if (!row?.length) return;

    const cols = table.columns ?? [];
    const colsHtml = cols.map((col, i) => {
      const cell = row[i];
      if (i > 0 && cell && typeof cell === "object") {
        // Sub-D6 table — roll D6 and look up within the cell
        const d6  = Math.ceil(Math.random() * 6);
        const val = LitmOracle._lookupRoll(cell, String(d6));
        return LitmOracle._colHtml(col, val, `d6: ${d6}`);
      }
      return LitmOracle._colHtml(col, typeof cell === "string" ? cell : null);
    }).join("");

    ChatMessage.create({
      content: `
        <div class="litm-oracle-chat">
          <div class="oracle-chat-header">
            <div class="oracle-chat-title">Oracle: Premade Profile</div>
            <div class="oracle-chat-roll">${rollStr}</div>
          </div>
          <div class="oracle-chat-cols">${colsHtml}</div>
        </div>
      `,
      speaker: { alias: "Oracle" }
    });
  }

  // Returns an array of { roll, val } entries for a column, expanding "Roll again twice"
  static _resolveEntries(table, colIdx, depth = 0) {
    const { tens, units, key } = LitmOracle._rollD66();
    const val      = (LitmOracle._lookupRoll(table.rolls, key) ?? [])[colIdx];
    const rollLabel = `${tens},${units}`;
    if (depth < 2 && typeof val === "string" && /roll again twice/i.test(val)) {
      return [
        { rollLabel, val },
        ...LitmOracle._resolveEntries(table, colIdx, depth + 1),
        ...LitmOracle._resolveEntries(table, colIdx, depth + 1),
      ];
    }
    return [{ rollLabel, val }];
  }

  // Renders all entries for a column under a single header
  static _renderColGroup(col, entries) {
    const valuesHtml = entries.map(({ rollLabel, val }) => {
      const display = rollLabel ? `${rollLabel}: ${val || "(no entry)"}` : (val || "(no entry)");
      return `<span class="oracle-chat-col-value">${display}</span>`;
    }).join("");
    return `
      <div class="oracle-chat-col">
        <span class="oracle-chat-col-label">${col}</span>
        ${valuesHtml}
      </div>
    `;
  }

  static _colHtml(col, val, roll = null) {
    const displayVal = roll ? `${roll}: ${val || "(no entry)"}` : (val || "(no entry)");
    return `
      <div class="oracle-chat-col">
        <span class="oracle-chat-col-label">${col}</span>
        <span class="oracle-chat-col-value">${displayVal}</span>
      </div>
    `;
  }

  /* ─── Render hook ────────────────────────────────────────── */

  _onRender(context, options) {
    super._onRender(context, options);
    const modeSelect = this.element?.querySelector(".oracle-mode-select");
    if (modeSelect) {
      modeSelect.value = this._oracleMode;
      modeSelect.addEventListener("change", e => { this._oracleMode = e.target.value; });
    }
    const roleSelect = this.element?.querySelector(".challenge-role-select");
    if (roleSelect) {
      roleSelect.value = this._challengeRole;
      roleSelect.addEventListener("change", e => { this._challengeRole = e.target.value; });
    }
    const vignetteSelect = this.element?.querySelector(".vignette-category-select");
    if (vignetteSelect) {
      vignetteSelect.value = this._vignetteCategory;
      vignetteSelect.addEventListener("change", e => { this._vignetteCategory = e.target.value; });
    }
    const actSelect = this.element?.querySelector(".revelation-act-select");
    if (actSelect) {
      actSelect.value = this._revelationAct;
      actSelect.addEventListener("change", e => { this._revelationAct = e.target.value; });
    }
    const profileSelect = this.element?.querySelector(".profile-category-select");
    if (profileSelect) {
      profileSelect.value = this._profileCategory;
      profileSelect.addEventListener("change", e => { this._profileCategory = e.target.value; });
    }
  }

  /* ─── Help ───────────────────────────────────────────────── */

  static _showHelp(event, target) {
    new foundry.applications.api.DialogV2({
      window: { title: "Oracle Import Format" },
      position: { width: 480 },
      content: `
        <div style="font-family: var(--font-primary); font-size: 13px; line-height: 1.7; padding: 2px 0;">
          <p>Oracle data is loaded from a <code>.json</code> file you provide. Each oracle has a <code>tables</code> array where each table defines:</p>
          <ul style="margin: 4px 0 8px 18px; padding: 0;">
            <li><strong>diceType</strong> is <code>"d66"</code> or <code>"d6"</code></li>
            <li><strong>columns</strong> is an array of column header strings</li>
            <li><strong>rolls</strong> maps roll keys to arrays of column values (one per column). d66 keys go from <code>"11"</code> to <code>"66"</code>; d6 keys go from <code>"1"</code> to <code>"6"</code>.</li>
          </ul>
          <p>Download the template below. It is a fully structured empty file covering all oracles, with comments explaining each field. Fill it in with your table content and use <strong>Import</strong> to load it.</p>
        </div>
      `,
      buttons: [
        {
          label: "Download Template",
          action: "download",
          callback: () => {
            const a = Object.assign(document.createElement("a"), {
              href:     "systems/legend-in-the-mist-foundry/assets/oracle-template.json",
              download: "oracle-template.json"
            });
            a.click();
          }
        },
        { label: "Close", action: "close", default: true }
      ]
    }).render(true);
  }

  /* ─── Import / Export ────────────────────────────────────── */

  static _importData(event, target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const json = JSON.parse(await file.text());
        if (typeof json !== "object" || Array.isArray(json)) throw new Error("Root must be an object.");
        await game.settings.set(SYSTEM_ID, "oracleData", json);
        await this.render();
        ui.notifications.info("Oracle data imported.");
      } catch (e) {
        ui.notifications.error(`Oracle import failed: ${e.message}`);
      }
    };
    input.click();
  }

  static _exportData(event, target) {
    const blob = new Blob(
      [JSON.stringify(game.settings.get(SYSTEM_ID, "oracleData") ?? {}, null, 2)],
      { type: "application/json" }
    );
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(blob),
      download: "oracle-data.json"
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
