/**
 * Enable inline editing on an input that normally has pointer-events:none.
 * Resets on blur.
 */
export function enableInlineEdit(input) {
  if (!input) return;
  input.style.pointerEvents = "auto";
  input.focus();
  input.select();
  input.addEventListener("blur", () => { input.style.pointerEvents = ""; }, { once: true });
}

/**
 * Row inputs use per-field "change" listeners that write back with
 * { render: false }. Those updates are async, so clicking an "add row"
 * button right after typing (before blur's change handler resolves) races
 * the add action's own update — the add reads the document before the edit
 * lands, and whichever update resolves second wins, silently dropping the
 * other. Re-reading each row's live DOM value here — instead of trusting
 * the document — closes that race for any "add" action.
 *
 * fields: [{ selector, prop, parse? }] — selector is the input's class
 * (queried together with `[data-<dataAttr>="<item.id>"]`), prop is the
 * list-item property it maps to, parse defaults to `value => value.trim()`.
 */
export function syncUnsavedInputs(root, list, dataAttr, fields) {
  for (const item of list) {
    for (const { selector, prop, parse } of fields) {
      const input = root.querySelector(`${selector}[data-${dataAttr}="${item.id}"]`);
      if (!input) continue;
      item[prop] = parse ? parse(input.value) : input.value.trim();
    }
  }
  return list;
}

/**
 * Same race as {@link syncUnsavedInputs}, for rows where the id lives on a
 * wrapping row element rather than the input itself (so the input can't be
 * matched with a single `[data-x]` selector) — e.g. `.bp-item[data-id]`
 * wrapping a bare `.bp-inp` with no id of its own.
 */
export function syncUnsavedInputsInRows(root, list, rowSelector, dataAttr, fields) {
  for (const item of list) {
    const row = root.querySelector(`${rowSelector}[data-${dataAttr}="${item.id}"]`);
    if (!row) continue;
    for (const { selector, prop, parse } of fields) {
      const input = row.querySelector(selector);
      if (!input) continue;
      item[prop] = parse ? parse(input.value) : input.value.trim();
    }
  }
  return list;
}

const INLINE_REF_CLASSES = {
  s:  "inline-status",
  b:  "inline-bold",
  l:  "inline-limit",
  m:  "inline-mighty-greatness",
  ma: "inline-mighty-adventure",
  w:  "inline-weakness"
};

/**
 * Parse the official module's inline bracket-reference syntax into styled
 * spans: [tag], [/s status-2], [/b bold text], [/l limit-2],
 * [/m greatness mighty aspect], [/ma adventure mighty aspect], [/w weakness].
 * Any other /prefix is rendered as plain unstyled text.
 */
export function parseInlineRefs(text) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(/\[([^\]]+)\]/g, (_, inner) => {
    const match = inner.match(/^\/(\w+)\s+(.*)$/);
    if (!match) return `<span class="inline-tag">${inner.trim()}</span>`;
    const [, prefix, value] = match;
    const cls = INLINE_REF_CLASSES[prefix];
    return cls
      ? `<span class="${cls}">${value.trim()}</span>`
      : `<span class="inline-plain">${value.trim()}</span>`;
  });
}

/**
 * Show a lightweight floating context menu at the cursor.
 * items: Array<{ label: string, action: () => void, danger?: boolean }>
 */
export function showContextMenu(event, items) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelector(".litm-ctx-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "litm-ctx-menu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top  = `${event.clientY}px`;

  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    if (item.danger) btn.dataset.danger = "";
    btn.addEventListener("click", e => { e.stopPropagation(); menu.remove(); item.action(); });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  setTimeout(() => {
    const close = e => {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", close, true); }
    };
    document.addEventListener("click", close, true);
  }, 0);
}
