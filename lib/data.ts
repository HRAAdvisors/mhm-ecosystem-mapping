import raw from "@/data/mhm-network.json";
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

/** Best-effort subsector (the tracker's original, raw category) for a name.
 *  Checked in two places: first a grantee's own "self row" (Organization
 *  blank, Grantee === name) -- the only place a pure grantee with no
 *  documented partner org can carry its own category -- then every row
 *  where the name appears as the "Organization" column (the normal case,
 *  where category is recorded for a partner organization). */
function lookupSubsector(name: string): string {
  for (const row of ALL_ROWS) {
    if (row.grantee === name && !row.organization && isRealCategory(row.primaryServiceCategory)) {
      return row.primaryServiceCategory;
    }
  }
  for (const row of ALL_ROWS) {
    if (row.organization === name && isRealCategory(row.primaryServiceCategory)) {
      return row.primaryServiceCategory;
    }
  }
  return GRANTEE_DEFAULT_SUBSECTOR;
}

/** Whether `name` holds an MHM grant outside the Digital Equity program,
 *  found the same way `lookupSubsector` finds a category: from any row
 *  where it appears as the "Organization" column, since that's where this
 *  is recorded. Null if the tracker never says either way for this name. */
function lookupOtherMhmGrantee(name: string): boolean | null {
  for (const row of ALL_ROWS) {
    if (row.organization === name && row.otherMhmGranteeStatus) {
      return row.otherMhmGranteeStatus === "Grantee";
    }
  }
  return null;
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

/** Prefers the org's own "Organization County" field (checking its own
 *  "Organization"-role rows), since that's kept up to date alongside its
 *  region. Falls back to a free-text "Location Cited in Source" quote only
 *  when no county is on file — that field is a per-row citation from
 *  whichever partner mentioned the org, and can go stale after a region
 *  correction (e.g. La Union del Pueblo Entero's region was corrected to
 *  Region J, but an old partner's row still cited "San Antonio / Central
 *  Texas area" for it). Falls back to the current region's label if the
 *  tracker doesn't cite anything for it. */
function lookupServiceArea(name: string, regionLabel: string): string {
  for (const row of ALL_ROWS) {
    if (row.organization === name && row.organizationCounty) return `${row.organizationCounty} County`;
  }
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
  const ownGranteeRows = ALL_ROWS.filter((row) => row.grantee === name);
  if (ownGranteeRows.length > 0) {
    const regions = new Set(
      ownGranteeRows
        .flatMap((row) => [row.granteeRegionCode, ...row.granteeAdditionalRegionCodes])
        .filter((code): code is string => !!code),
    );
    return regions.size <= 1;
  }
  const ownOrgRows = ALL_ROWS.filter((row) => row.organization === name);
  const regions = new Set(
    ownOrgRows.flatMap((row) => [row.regionCode, ...row.additionalRegionCodes]).filter((code): code is string => !!code),
  );
  return regions.size <= 1;
}

export interface OrgIndexEntry {
  name: string;
  regionCode: string;
  regionLabel: string;
  category: string;
}

let _orgIndex: OrgIndexEntry[] | null = null;

/**
* A flat index of every organization in every region it appears in, for the
* global search. An org that spans multiple regions gets one entry per region
* (each shows its own region label), so searching a name surfaces every place
* you can jump to — not just its home region. Within a name, the primary/home
* region is listed first. Pure graph structure — no Airtable — so it's safe to
* build on the client. Memoized since it walks all region graphs.
*/
export function getOrganizationIndex(): OrgIndexEntry[] {
if (_orgIndex) return _orgIndex;
const entries: (OrgIndexEntry & { primary: boolean })[] = [];
for (const region of REGIONS) {
const { nodes } = buildGraph(region.code);
for (const node of nodes) {
entries.push({
name: node.id,
regionCode: region.code,
regionLabel: region.label,
category: node.category,
primary: node.locationStatus === "primary",
});
}
}
_orgIndex = entries
.sort((a, b) => {
const byName = a.name.localeCompare(b.name);
if (byName !== 0) return byName;
// Same org: primary/home region first, then a stable region order.
if (a.primary !== b.primary) return a.primary ? -1 : 1;
return a.regionCode.localeCompare(b.regionCode);
})
.map(({ primary: _primary, ...entry }) => entry);
return _orgIndex;
}

/**
 * True if `row`'s ORGANIZATION serves `regionCode` (its own region or one of
 * its additional regions).
 */
function organizationServesRegion(row: TrackerRow, regionCode: string): boolean {
  return row.regionCode === regionCode || row.additionalRegionCodes.includes(regionCode);
}

/**
 * True if `row`'s GRANTEE serves `regionCode` (its own region or one of its
 * additional regions, for a grantee that genuinely serves more than one).
 */
function granteeServesRegion(row: TrackerRow, regionCode: string): boolean {
  return row.granteeRegionCode === regionCode || row.granteeAdditionalRegionCodes.includes(regionCode);
}

/** Higher is stronger; unset/unrecognized strength sorts last. */
function relationshipStrengthRank(strength: string | null): number {
  if (strength === "Strong/Active") return 2;
  if (strength === "Weak/Existing") return 1;
  return 0;
}

/**
 * The tracker records one row per source document that mentions a
 * grantee-organization pair, so the same real-world relationship often has
 * several rows (e.g. one from the 2025 Year-End survey, one from the 2026
 * Mid-Year survey, one from an older tab) — sometimes disagreeing on
 * strength. Collapses a group of rows for the same pair down to the single
 * best one: whichever reports the strongest relationship, and among ties,
 * whichever appears latest in the tracker (later rows are where more recent
 * corrections/updates tend to land).
 */
function pickBestRow(rows: TrackerRow[]): TrackerRow {
  return rows.reduce((best, row) => {
    const rank = relationshipStrengthRank(row.relationshipStrength);
    const bestRank = relationshipStrengthRank(best.relationshipStrength);
    if (rank > bestRank) return row;
    if (rank === bestRank && row.sourceRow > best.sourceRow) return row;
    return best;
  });
}

/** Groups rows by a key, then keeps only the best row from each group. */
function dedupeRows(rows: TrackerRow[], keyOf: (row: TrackerRow) => string): TrackerRow[] {
  const groups = new Map<string, TrackerRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.values()).map(pickBestRow);
}

export function buildGraph(regionCode: string): Graph {
  const regionLabel = REGIONS.find((r) => r.code === regionCode)?.label ?? regionCode;

  // A name belongs in this region if ITS OWN role-appropriate rows say so:
  // an organization via its organization-role rows, a grantee via its
  // grantee-role rows. This is judged independent of whoever else appears
  // on that row, so a grantee (or partner org) still shows up in its own
  // home region even when every one of its documented relationships happens
  // to be with a counterpart based somewhere else — e.g. a Region D grantee
  // whose only tracked partners are Region J organizations still belongs on
  // Region D's map.
  const names = new Set<string>();
  for (const row of ALL_ROWS) {
    if (organizationServesRegion(row, regionCode)) names.add(row.organization);
    if (row.grantee && granteeServesRegion(row, regionCode)) names.add(row.grantee);
  }

  // A relationship only draws a link (and shows as a "connection" on either
  // node) in this region if BOTH parties are themselves region members.
  // Otherwise a grantee's partnership with an out-of-region organization
  // would incorrectly pull that organization's own node into this region's
  // graph — e.g. La Union del Pueblo Entero (Region J) funding a
  // partnership with digitalLIFT (Region D) doesn't mean LUPE provides
  // service in Region D, so that relationship shouldn't render there even
  // though digitalLIFT itself does.
  const regionalRows = ALL_ROWS.filter(
    (row) => names.has(row.organization) && (!row.grantee || names.has(row.grantee)),
  );

  const nodes: GraphNode[] = Array.from(names).map((name) => {
    const touchedRegions = new Set<string>();
    const secondaryRegions = new Set<string>();
    for (const row of ALL_ROWS) {
      if (row.grantee === name) {
        if (row.granteeRegionCode) touchedRegions.add(row.granteeRegionCode);
        for (const code of row.granteeAdditionalRegionCodes) secondaryRegions.add(code);
      } else if (row.organization === name) {
        if (row.regionCode) touchedRegions.add(row.regionCode);
        for (const code of row.additionalRegionCodes) secondaryRegions.add(code);
      }
    }
    const krpRow = regionalRows.find(
      (row) => row.organization === name && row.section === "key_regional_player",
    );
    const subsector = krpRow && isRealCategory(krpRow.primaryServiceCategory)
      ? krpRow.primaryServiceCategory
      : lookupSubsector(name);
    const category = mapCategory(subsector);

    const ownConnectionRows = regionalRows.filter((row) => row.grantee === name || row.organization === name);
    const connections: GraphNode["connections"] = dedupeRows(ownConnectionRows, (row) =>
      row.grantee === name ? row.organization : (row.grantee ?? "Unknown"),
    ).map((row) => ({
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
      otherMhmGrantee: lookupOtherMhmGrantee(name),
      primaryRegionCodes: Array.from(touchedRegions),
      secondaryRegionCodes: Array.from(secondaryRegions),
      section: krpRow ? "key_regional_player" : "relationship",
      connections,
      notes: krpRow?.notesFlags ?? null,
      // KPIs are no longer baked in at build time. They come from Airtable
      // (live, server-side) and are attached to each node by the region page
      // / NetworkExplorer via fuzzyKey. buildGraph stays pure graph structure
      // so it can keep running client-side without the Airtable token.
      kpi: null,
    };
  });

  const linkRows = dedupeRows(
    regionalRows.filter((row) => !!row.grantee),
    (row) => `${row.grantee}::${row.organization}`,
  );
  const links = linkRows.map((row) => ({
    source: row.grantee as string,
    target: row.organization,
    relationshipType: row.relationshipType,
    relationshipStrength: row.relationshipStrength,
    row,
  }));

  return { nodes, links };
}

export interface PortfolioTotals {
  /** Distinct orgs that have ever been an MHM Digital Equity grantee. */
  granteeCount: number;
  /** Distinct partner orgs that are never themselves a grantee. */
  partnerOrgCount: number;
  /** Distinct grantee-partner relationships, counted once even if the pair
   *  shows up in more than one region (e.g. a multi-region grantee). */
  relationshipCount: number;
}

let _portfolioTotals: PortfolioTotals | null = null;

/**
 * Portfolio-wide counts used on the homepage's Key Findings section. These
 * are computed from the same region graphs the network pages render (not a
 * separately hand-maintained figure), so they can't drift out of sync with
 * what the ecosystem maps actually show the way a hardcoded number can.
 */
export function getPortfolioTotals(): PortfolioTotals {
  if (_portfolioTotals) return _portfolioTotals;
  const grantees = new Set<string>();
  const partners = new Set<string>();
  const relationships = new Set<string>();
  for (const region of REGIONS) {
    const { nodes, links } = buildGraph(region.code);
    for (const node of nodes) (node.isGrantee ? grantees : partners).add(node.id);
    for (const link of links) relationships.add(`${link.source}::${link.target}`);
  }
  _portfolioTotals = {
    granteeCount: grantees.size,
    partnerOrgCount: partners.size,
    relationshipCount: relationships.size,
  };
  return _portfolioTotals;
}
