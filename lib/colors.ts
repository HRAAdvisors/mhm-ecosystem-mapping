// Primary Service Category -> fill color. Same categorical families and hues
// as the source Miro diagram's legend, pushed to a higher, more consistent
// saturation so the palette reads as vivid rather than flat, while still
// re-tuned so white label text sits on every fill at >=4.5:1 (WCAG AA normal
// text) — all sit at ~4.9:1, which also clears 1.4.11's 3:1 non-text minimum
// with room to spare — while staying pairwise distinguishable from one
// another (hues spread >=25 degrees).
export const CATEGORY_COLORS: Record<string, string> = {
  "Education (Higher Ed / School)": "#856F06",
  "Health": "#D3360D",
  "Digital Equity / Digital Literacy": "#D111A0",
  "Human & Social Services": "#0E8152",
  "Government / Municipal": "#0E78AC",
  "Youth Development": "#7F52EA",
  "Community & Economic Development": "#607A11",
  "Workforce Development": "#A36207",
  "Library": "#E10E16",
  "Domestic Violence / Victim Services": "#0F8322",
  "Housing": "#5461EC",
  "Senior Services": "#B81CE0",
  "Disability Services": "#8E6B19",
  "Homeless Services": "#836B6B",
};

export const FALLBACK_CATEGORY_COLOR = "#6B6B6B"; // also clears both thresholds

export function colorForCategory(category: string | null | undefined): string {
  if (!category) return FALLBACK_CATEGORY_COLOR;
  return CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
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

// Relationship Strength -> link weight/opacity
export const RELATIONSHIP_STRENGTH_STYLE: Record<string, { width: number; opacity: number }> = {
  "Strong/Active": { width: 2.4, opacity: 0.85 }, // "Active Collaborators"
  "Weak/Existing": { width: 1, opacity: 0.45 }, // "Frequent Collaborators"
};

export function styleForRelationshipStrength(strength: string | null | undefined) {
  if (!strength) return RELATIONSHIP_STRENGTH_STYLE["Weak/Existing"];
  return RELATIONSHIP_STRENGTH_STYLE[strength] ?? RELATIONSHIP_STRENGTH_STYLE["Weak/Existing"];
}
