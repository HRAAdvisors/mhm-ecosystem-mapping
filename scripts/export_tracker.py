"""
One-time export of the MHM Collaborations Tracker workbook into a static JSON
file consumed by the Next.js app (data/mhm-network.json).

Source (client-provided, not committed to this repo):
  OneDrive: Digital Opportunity - 260299 - MHM Broadband Infrastructure Mapping
            /3. Analysis/WS2/MHM Collaborations Tracker - Final.xlsx

Re-run this script and commit the regenerated JSON whenever the tracker changes:
  python3 scripts/export_tracker.py "/path/to/MHM Collaborations Tracker - Final.xlsx"
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl

DEFAULT_SOURCE = (
    "/Users/eddiejoeantonio/Library/CloudStorage/OneDrive-SharedLibraries-HR&AAdvisors,Inc/"
    "Digital Opportunity - 260299 - MHM Broadband Infrastructure Mapping/"
    "3. Analysis/WS2/MHM Collaborations Tracker - Final.xlsx"
)

SHEET_NAME = "Master Grantee-Org Sheet"

COLUMNS = [
    "grantee",
    "organization",
    "isGrantee",
    "confirmationStatus",
    "relationshipType",
    "relationshipTypeRationale",
    "relationshipStrength",
    "relationshipStrengthRationale",
    "region",
    "additionalRegions",
    "regionSourceJustification",
    "primaryServiceCategory",
    "categoryConfidence",
    "categoryJustification",
    "granteeFundingAmount",
    "fundingSource",
    "evidenceQuote",
    "sourceDocuments",
    "locationCited",
    "newVsExisting",
    "notesFlags",
    "activeGrant2026",
]

REGION_RE = re.compile(r"^Region ([A-L])\b")

REGION_LABELS = {
    "A": "Region A — Concho Valley / San Angelo",
    "B": "Region B — Texas Hill Country",
    "C": "Region C — Travis County / Austin",
    "D": "Region D — Bexar County / San Antonio",
    "E": "Region E — Bastrop-Hays-Fayette",
    "F": "Region F — Medina-Atascosa-Guadalupe",
    "G": "Region G — Victoria / Coastal Plains",
    "H": "Region H — Corpus Christi / Coastal Bend",
    "J": "Region J — South Texas / Rio Grande Valley",
    "K": "Region K — Tri-County (Laredo)",
    "L": "Region L — Mid-Border Region",
}


def region_code(raw):
    if not raw:
        return None
    m = REGION_RE.match(str(raw).strip())
    return m.group(1) if m else None


def additional_region_codes(raw):
    if not raw:
        return []
    codes = []
    for part in str(raw).split(";"):
        c = region_code(part.strip())
        if c and c not in codes:
            codes.append(c)
    return codes


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def find_section_bounds(ws):
    """Locate the two header rows ('Grantee' in col A) and the row ranges below each."""
    header_rows = []
    for r in range(1, ws.max_row + 1):
        if ws.cell(row=r, column=1).value == "Grantee":
            header_rows.append(r)
    if len(header_rows) != 2:
        raise RuntimeError(f"Expected 2 header rows, found {len(header_rows)}: {header_rows}")
    relationship_start = header_rows[0] + 1
    relationship_end = header_rows[1] - 1  # exclusive of the KRP section-title row
    # walk back past the blank/section-title row(s) preceding the second header
    while relationship_end > relationship_start and all(
        ws.cell(row=relationship_end, column=c).value is None for c in range(1, 4)
    ):
        relationship_end -= 1
    krp_start = header_rows[1] + 1
    krp_end = ws.max_row
    return (relationship_start, relationship_end), (krp_start, krp_end)


def extract_rows(ws, start, end, section):
    rows = []
    for r in range(start, end + 1):
        values = [clean(ws.cell(row=r, column=c).value) for c in range(1, len(COLUMNS) + 1)]
        if all(v is None for v in values):
            continue
        row = dict(zip(COLUMNS, values))
        if not row.get("organization"):
            continue
        row["section"] = section
        row["sourceRow"] = r
        row["regionCode"] = region_code(row.get("region"))
        row["additionalRegionCodes"] = additional_region_codes(row.get("additionalRegions"))
        rows.append(row)
    return rows


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    out_path = Path(__file__).resolve().parent.parent / "data" / "mhm-network.json"

    wb = openpyxl.load_workbook(source, data_only=True)
    ws = wb[SHEET_NAME]

    (rel_start, rel_end), (krp_start, krp_end) = find_section_bounds(ws)
    rows = extract_rows(ws, rel_start, rel_end, "relationship")
    rows += extract_rows(ws, krp_start, krp_end, "key_regional_player")

    present_codes = set()
    for row in rows:
        if row["regionCode"]:
            present_codes.add(row["regionCode"])
        present_codes.update(row["additionalRegionCodes"])

    regions = [
        {"code": code, "label": REGION_LABELS.get(code, f"Region {code}")}
        for code in sorted(present_codes)
    ]

    categories = sorted(
        {
            row["primaryServiceCategory"]
            for row in rows
            if row["primaryServiceCategory"]
            and "N/A" not in row["primaryServiceCategory"]
            and row["primaryServiceCategory"] != "Unable to classify"
        }
    )

    payload = {
        "generatedAt": date.today().isoformat(),
        "sourceSheet": SHEET_NAME,
        "regions": regions,
        "categories": categories,
        "rows": rows,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"Wrote {len(rows)} rows ({len(regions)} regions) to {out_path}")


if __name__ == "__main__":
    main()
