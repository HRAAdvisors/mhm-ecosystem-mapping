// Organization Service Type -> fill color (see lib/data.ts's CATEGORY_MAP
// for how the tracker's raw "Service Subsector" categories roll up into
// these 5). textColorForFill below picks white or dark label text per-color
// at runtime so this palette doesn't need to be pre-tuned for contrast.
export const CATEGORY_COLORS: Record<string, string> = {
  "Education & Youth Development": "#173F5F",
  "Health & Wellness": "#ED553B",
  "Housing & Community Development": "#20639B",
  "Workforce Training": "#F6D55C",
  "Digital Literacy and Device Support": "#3CAEA3",
};

export const FALLBACK_CATEGORY_COLOR = "#6B6B6B"; // also clears both thresholds

export function colorForCategory(category: string | null | undefined): string {
  if (!category) return FALLBACK_CATEGORY_COLOR;
  return CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
}

// Grantee Status -> fill color: darkest blue for current grantees, a
// lighter blue for past grantees, and light gray for orgs that have never
// been a grantee (so "not a grantee" doesn't read as just another, paler
// shade of the same blue).
export const GRANTEE_STATUS_COLORS: Record<"current" | "past" | "not", string> = {
  current: "#0B3D6B",
  past: "#4E86B8",
  not: "#C7CCD1",
};

export function colorForGranteeStatus(status: "current" | "past" | "not"): string {
  return GRANTEE_STATUS_COLORS[status];
}

const RAISIN = "#1B1B33";
const WHITE = "#FFFFFF";

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const AA_NORMAL_TEXT = 4.5;

/** White label text on every category fill, falling back to dark (raisin)
 *  text only where white wouldn't clear WCAG AA's 4.5:1 normal-text minimum.
 *  The palette above is tuned so every category clears that bar with white
 *  (~4.8:1) — this fallback exists for FALLBACK_CATEGORY_COLOR or any future
 *  palette tweak that doesn't. */
export function textColorForFill(fill: string): string {
  if (contrastRatio(WHITE, fill) >= AA_NORMAL_TEXT) return WHITE;
  return contrastRatio(RAISIN, fill) >= contrastRatio(WHITE, fill) ? RAISIN : WHITE;
}

// Relationship Type -> link style
export const RELATIONSHIP_TYPE_STYLE: Record<string, { dash: string | null }> = {
  "Grantee Collaboration": { dash: null }, // solid
  "Funding Relationship": { dash: "6,4" }, // dashed
};

export function dashForRelationshipType(type: string | null | undefined): string | null {
  if (!type) return null;
  return RELATIONSHIP_TYPE_STYLE[type]?.dash ?? null;
}

// Relationship Strength -> link opacity. Width is no longer driven by
// strength — it privileges current grantees instead (see
// GRANTEE_LINK_WIDTH / NetworkGraph).
export const RELATIONSHIP_STRENGTH_STYLE: Record<string, { opacity: number }> = {
  "Strong/Active": { opacity: 0.85 }, // "Active Collaborators"
  "Weak/Existing": { opacity: 0.45 }, // "Frequent Collaborators"
};

export function opacityForRelationshipStrength(strength: string | null | undefined): number {
  if (!strength) return RELATIONSHIP_STRENGTH_STYLE["Weak/Existing"].opacity;
  return (RELATIONSHIP_STRENGTH_STYLE[strength] ?? RELATIONSHIP_STRENGTH_STYLE["Weak/Existing"]).opacity;
}

// Current grantees' relationships get a visibly heavier stroke than everyone
// else's, so the diagram privileges the org MHM is actively funding right now
// over other partners/collaborators.
export const GRANTEE_LINK_WIDTH: Record<"current" | "other", number> = {
  current: 3,
  other: 1.2,
};
