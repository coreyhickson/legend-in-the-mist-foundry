/**
 * Rewrite Forge VTT CDN URLs into paths that resolve locally, for both
 * plain field values (img, texture.src) and HTML content with embedded
 * <img> tags (journal pages). Two patterns seen in the official export:
 *   - https://assets.forge-vtt.com/<forge-id>/modules/<module-id>/assets/...
 *     -> modules/<module-id>/assets/...   (resolves once that module is installed)
 *   - https://assets.forge-vtt.com/bazaar/core/<path>
 *     -> <path>   (a Foundry core asset, always available)
 * Anything else is left untouched.
 */
const MODULE_ASSET_RE = /https:\/\/assets\.forge-vtt\.com\/[^/"'\s]+\/modules\/([^"'\s]+)/g;
const BAZAAR_CORE_RE  = /https:\/\/assets\.forge-vtt\.com\/bazaar\/core\/([^"'\s]+)/g;

export async function getOrCreateWorldPack(name, label, type) {
  const existing = game.packs.get(`world.${name}`);
  if (existing) return existing;
  return CompendiumCollection.createCompendium({
    name,
    label,
    type,
    system: "legend-in-the-mist-foundry",
  });
}

export function rewriteForgeAssetUrl(text) {
  if (!text) return text;
  return text
    .replace(MODULE_ASSET_RE, (_, rest) => `modules/${rest}`)
    .replace(BAZAAR_CORE_RE, (_, rest) => rest);
}

const id = () => foundry.utils.randomID();

/** Fixed 11-role list the Challenge sheet's dropdown supports; known aliases
 *  fold in, anything else is dropped rather than widening the dropdown back
 *  to free text. */
const KNOWN_ROLES  = ["Aggressor", "Pursuer", "Charge", "Countdown", "Influence", "Mystery", "Obstacle", "Quarry", "Sapper", "Support", "Watcher"];
const ROLE_ALIASES = { Charger: "Charge" };

export function convertRoles(list) {
  const out = [];
  for (const raw of (list ?? [])) {
    const role = ROLE_ALIASES[raw] ?? raw;
    if (KNOWN_ROLES.includes(role) && !out.includes(role)) out.push(role);
  }
  return out;
}

/** floatingTagsAndStatuses[] -> { tags[], statuses[] }, split on isStatus.
 *  The source always marks exactly one box (at `value`), never a
 *  contiguous fill, so markedBoxes is always the single-element [tier]. */
export function splitTagsAndStatuses(list) {
  const tags = [], statuses = [];
  for (const f of (list ?? [])) {
    if (f.isStatus) {
      const tier = Math.min(Math.max(parseInt(f.value) || 1, 1), 6);
      statuses.push({ id: id(), name: f.name ?? "", tier, markedBoxes: [tier] });
    } else {
      tags.push({ id: id(), name: f.name ?? "", scratched: false, singleUse: false });
    }
  }
  return { tags, statuses };
}

/** limits[] -> our limits[] shape. value of "", "-", "–", "—" means immunity. */
export function convertLimits(list) {
  return (list ?? []).map(l => {
    const raw = (l.value ?? "").toString().trim();
    const isImmunity = ["", "-", "–", "—"].includes(raw);
    return {
      id: id(),
      name: l.name ?? "",
      max: isImmunity ? null : (parseInt(raw) || 3),
      current: 0,
      isImmunity,
      isProgress: false,
      specialFeature: l.consequence ?? "",
    };
  });
}

/** threatsAndConsequences[] -> { threats[], consequences[] } linked by id. */
export function convertThreatsAndConsequences(list) {
  const threats = [], consequences = [];
  for (const t of (list ?? [])) {
    const threatId = id();
    threats.push({ id: threatId, name: t.name ?? "", description: t.description ?? "", consequenceIds: [] });
    for (const desc of (t.list ?? [])) {
      consequences.push({ id: id(), description: desc, linkedThreatId: threatId });
    }
  }
  return { threats, consequences };
}

export function convertMightyAspects(list) {
  return (list ?? []).map(m => ({
    id: id(),
    aspect: m.aspect ?? "",
    level: m.level === "greatness" ? "greatness" : "adventure",
  }));
}

/** Shared shape for secrets[] / specialFeatures[]: { name, description }. */
export function convertNamedNotes(list) {
  return (list ?? []).map(x => ({ id: id(), name: x.name ?? "", description: x.description ?? "" }));
}

/** Journey's system.tags is a comma-separated "[tag], [tag]" string, not an array. */
export function parseBracketTagString(str) {
  if (!str) return [];
  return [...str.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
}

/** "SKILL OR TRADE" -> "skill-or-trade", matching THEME_TYPE_GROUPS slugs
 *  in themekit-sheet.mjs exactly (verified against all 20 real values). */
export function slugifyThemeType(raw) {
  if (!raw) return "";
  return raw.toLowerCase().trim().replace(/\s+/g, "-");
}
