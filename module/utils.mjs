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
