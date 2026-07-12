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
