import raw from "@/data/mhm-network.json";
import { getKpiForOrg } from "./kpi";
import type { Graph, GraphNode, RegionMeta, TrackerDataset, TrackerRow } from "./types";

const dataset = raw as TrackerDataset;

export const REGIONS: RegionMeta[] = dataset.regions;
export const GENERATED_AT = dataset.generatedAt;

/** The tracker's raw "Primary Service Category" column (14 values) is kept
 *  as-is and shown in the sidepanel as "Service Subsector." This maps it to
 *  5 broader "Organization Service Type" groupings, used for node color and
 *  the category filter/legend. */
const CATEGORY_MAP: Record<string, string> = {
  "Education (Higher Ed / School)": "Education & Youth Development",
  "Youth Development": "Education & Youth Development",
  "Library": "Education & Youth Development",
  "Health": "Health & Wellness",
  "Human & Social Services": "Health & Wellness",
  "Senior Services": "Health & Wellness",
  "Disability Services": "Health & Wellness",
  "Domestic Violence / Victim Services": "Health & Wellness",
  "Homeless Services": "Health & Wellness",
  "Housing": "Housing & Community Development",
  "Community & Economic Development": "Housing & Community Development",
  "Government / Municipal": "Housing & Community Development",
  "Workforce Development": "Workforce Training",
  "Digital Equity / Digital Literacy": "Digital Literacy and Device Support",
};

export const CATEGORIES: string[] = [
  "Education & Youth Development",
  "Health & Wellness",
  "Housing & Community Development",
  "Workforce Training",
  "Digital Literacy and Device Support",
];

function mapCategory(raw: string): string {
  return CATEGORY_MAP[raw] ?? raw;
}

/** Collapse spelling/punctuation variants ("Boys and Girls Clubs of Laredo" vs
 *  "Boys & Girls Clubs of Laredo", "Compudopt" vs "Compudopt (South Texas
 *  Empowerment Initiative)") of the same real-world org onto one canonical id,
 *  chosen as whichever raw string appears most often in the tracker. */
function buildCanonicalNameMap(rows: TrackerRow[]): Map<string, string> {
  const fuzzyKey = (name: string) =>
    name
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const counts = new Map<string, Map<string, number>>();
  const tally = (name: string | null) => {
    if (!name) return;
    const key = fuzzyKey(name);
    if (!key) return;
    const variants = counts.get(key) ?? new Map<string, number>();
    variants.set(name, (variants.get(name) ?? 0) + 1);
    counts.set(key, variants);
  };
  for (const row of rows) {
    tally(row.grantee);
    tally(row.organization);
  }

  const canonical = new Map<string, string>();
  for (const variants of counts.values()) {
    if (variants.size < 2) continue;
    const [bestName] = Array.from(variants.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].length - b[0].length,
    )[0];
    for (const variant of variants.keys()) canonical.set(variant, bestName);
  }
  return canonical;
}

const CANONICAL_NAMES = buildCanonicalNameMap(dataset.rows);
const canon = (name: string) => CANONICAL_NAMES.get(name) ?? name;

const ALL_ROWS: TrackerRow[] = dataset.rows.map((row) => ({
  ...row,
  grantee: row.grantee ? canon(row.grantee) : row.grantee,
  organization: canon(row.organization),
}));

const NON_CATEGORY = new Set(["N/A (MHM Grantee)", "N/A - not a real organization", "Unable to classify"]);
const GRANTEE_DEFAULT_SUBSECTOR = "Digital Equity / Digital Literacy";

function isRealCategory(value: string | null): value is string {
  return !!value && !NON_CATEGORY.has(value);
}

function isRealFunding(value: string | null): value is string {
  return !!value && value.trim().startsWith("$");
}

/** Best-effort subsector (the tracker's original, raw category) for a name,
 *  found by looking at every row where it appears as the "Organization"
 *  column (which is where category is actually recorded). */
function lookupSubsector(name: string): string {
  for (const row of ALL_ROWS) {
    if (row.organization === name && isRealCategory(row.primaryServiceCategory)) {
      return row.primaryServiceCategory;
    }
  }
  return GRANTEE_DEFAULT_SUBSECTOR;
}

interface FundingInfo {
  amount: string;
  year: string | null;
  sourceLabel: string | null;
}

/** The tracker appends a parenthetical caveat to some amounts (e.g. "(all
 *  MHM programs, DE-specific total not found)") that belongs in the source
 *  description, not the dollar figure itself. */
function cleanFundingAmount(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Pulls every plausible year (1900-2099) out of a funding-source citation
 *  like "...per 2025 Comm Impact Report..." or "...FY2026...", so the
 *  sidepanel can show what year(s) a figure covers without repeating the
 *  tracker's full citation text. */
function extractFundingYears(text: string): string | null {
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  if (!matches) return null;
  return Array.from(new Set(matches)).sort().join(", ");
}

/** Reduces the tracker's verbose, file-citation-style funding source text
 *  down to a plain description of what the figure represents. */
function describeFundingSource(source: string): string {
  if (/all mhm (program )?themes/i.test(source)) {
    return "All MHM Programs, not specific to digital equity funding";
  }
  if (/digital equity theme/i.test(source)) {
    return "MHM Digital Equity Program";
  }
  return source;
}

/** Best-effort funding info for a name: prefer a row where it appears as the
 *  grantee (funding describes the grantee's own award), else as a Key Regional
 *  Player organization (funding describes that org's own MHM award). */
function lookupFunding(name: string): FundingInfo | null {
  const row =
    ALL_ROWS.find((r) => r.grantee === name && isRealFunding(r.granteeFundingAmount)) ??
    ALL_ROWS.find(
      (r) => r.organization === name && r.section === "key_regional_player" && isRealFunding(r.granteeFundingAmount),
    );
  if (!row?.granteeFundingAmount) return null;
  const source = row.fundingSource;
  return {
    amount: cleanFundingAmount(row.granteeFundingAmount),
    year: source ? extractFundingYears(source) : null,
    sourceLabel: source ? describeFundingSource(source) : null,
  };
}

/** Prefers a specific county/city the tracker cites for this org (checking its
 *  own "Organization"-role rows first, since that's where locations are
 *  written up in detail), falling back to the current region's label when
 *  the tracker doesn't cite one for it. */
function lookupServiceArea(name: string, regionLabel: string): string {
  for (const row of ALL_ROWS) {
    if (row.organization === name && row.locationCited) return row.locationCited;
  }
  for (const row of ALL_ROWS) {
    if (row.grantee === name && row.locationCited) return row.locationCited;
  }
  return regionLabel;
}

function lookupActiveGrant(name: string): string | null {
  for (const row of ALL_ROWS) {
    if (row.grantee === name && row.activeGrant2026) {
      return row.activeGrant2026;
    }
  }
  return null;
}

function isGranteeAnywhere(name: string): boolean {
  return ALL_ROWS.some(
    (row) => row.grantee === name || (row.organization === name && row.isGrantee === "Yes"),
  );
}

/** "Current Grantee" if any of its own rows carry the 2026 active-grant flag,
 *  "Past Grantee" if it's a grantee (anywhere) without that flag, else "Not a
 *  Grantee" for pure partner/Key Regional Player orgs. */
function granteeStatusFor(name: string, isGrantee: boolean): GraphNode["granteeStatus"] {
  if (!isGrantee) return "not";
  const isCurrentlyActive = ALL_ROWS.some((row) => row.grantee === name && row.activeGrant2026 === "Yes");
  return isCurrentlyActive ? "current" : "past";
}

/**
 * Is `regionCode` this org's one home base, or just one of several regions it
 * touches?
 *
 * The tracker's "Region (MHM Crosswalk)" column is recorded per relationship,
 * not per org: for a grantee-authored row it's normally the grantee's own
 * MHM-registered county, but a wide-reaching grantee can have that column
 * point to a different region on almost every row (Compudopt alone spans
 * regions C, D, J and K across its own rows). Picking "primary" from a single
 * row — including the very row that put this node in the current region's
 * graph — makes every node primary everywhere, which is meaningless.
 *
 * Instead this looks at every row where `name` carries its own location (as
 * the grantee, since that column reflects the grantee's registered county) —
 * or, for an org that's never a grantee, every row where it's the
 * organization, since that's the only role that ever names it. If those rows
 * only ever cite one region, this is a single-site org and that region is its
 * home. If they cite several, `name` is a multi-region actor for whom no
 * single region (including this one) is uniquely "home" — matches how the
 * source Miro board dashes wide-reaching grantees like Compudopt even inside
 * the one region diagram they're shown in.
 */
function isSingleRegionOrg(name: string): boolean {
  const ownRows = ALL_ROWS.filter((row) => row.grantee === name);
  const rowsCarryingLocation = ownRows.length > 0 ? ownRows : ALL_ROWS.filter((row) => row.organization === name);
  const regions = new Set(rowsCarryingLocation.map((row) => row.regionCode).filter((code): code is string => !!code));
  return regions.size <= 1;
}

export function buildGraph(regionCode: string): Graph {
  const regionalRows = ALL_ROWS.filter((row) => row.regionCode === regionCode);
  const regionLabel = REGIONS.find((r) => r.code === regionCode)?.label ?? regionCode;

  const names = new Set<string>();
  for (const row of regionalRows) {
    if (row.grantee) names.add(row.grantee);
    names.add(row.organization);
  }

  const nodes: GraphNode[] = Array.from(names).map((name) => {
    const touchedRegions = new Set<string>();
    const secondaryRegions = new Set<string>();
    for (const row of ALL_ROWS) {
      if (row.grantee !== name && row.organization !== name) continue;
      if (row.regionCode) touchedRegions.add(row.regionCode);
      for (const code of row.additionalRegionCodes) secondaryRegions.add(code);
    }
    const krpRow = regionalRows.find(
      (row) => row.organization === name && row.section === "key_regional_player",
    );
    const subsector = krpRow && isRealCategory(krpRow.primaryServiceCategory)
      ? krpRow.primaryServiceCategory
      : lookupSubsector(name);
    const category = mapCategory(subsector);

    const connections: GraphNode["connections"] = regionalRows
      .filter((row) => row.grantee === name || row.organization === name)
      .map((row) => ({
        other: row.grantee === name ? row.organization : (row.grantee ?? "Unknown"),
        direction: row.grantee === name ? "outgoing" : "incoming",
        relationshipType: row.relationshipType,
        relationshipStrength: row.relationshipStrength,
      }));

    const isGrantee = isGranteeAnywhere(name);
    const funding = lookupFunding(name);

    return {
      id: name,
      category,
      subsector,
      isGrantee,
      granteeStatus: granteeStatusFor(name, isGrantee),
      locationStatus: isSingleRegionOrg(name) ? "primary" : "secondary",
      serviceArea: lookupServiceArea(name, regionLabel),
      fundingAmount: funding?.amount ?? null,
      fundingYear: funding?.year ?? null,
      fundingSourceLabel: funding?.sourceLabel ?? null,
      activeGrant: lookupActiveGrant(name),
      primaryRegionCodes: Array.from(touchedRegions),
      secondaryRegionCodes: Array.from(secondaryRegions),
      section: krpRow ? "key_regional_player" : "relationship",
      connections,
      notes: krpRow?.notesFlags ?? null,
      kpi: getKpiForOrg(name),
    };
  });

  const links = regionalRows
    .filter((row) => !!row.grantee)
    .map((row) => ({
      source: row.grantee as string,
      target: row.organization,
      relationshipType: row.relationshipType,
      relationshipStrength: row.relationshipStrength,
      row,
    }));

  return { nodes, links };
}
