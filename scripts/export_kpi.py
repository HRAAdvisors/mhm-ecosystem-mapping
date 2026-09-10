"""
One-time export of the MHM Digital Equity KPI report CSVs into a static JSON
file consumed by the Next.js app (data/mhm-kpi.json).

Sources (client-provided, not committed to this repo):
  OneDrive: Digital Opportunity - 260299 - MHM Broadband Infrastructure Mapping
            /3. Analysis/WS2/Client Data/Updated Data 08202026/2024-2026 KPI Reports/
    - 2024 Mid Year KPI Report.csv
    - 2024 Year End KPT Report.csv
    - 2025 Digital Equity Mid-Year_KPI Report .csv
    - NEW-2025 Digital Equity Year End_KPI Report.csv
    - 2026 Digital Equity Mid-Year_KPI Report.csv

Each report is a Microsoft Forms export with a slightly different column set
(the 2025 Year-End and 2026 Mid-Year forms added ID/contact columns up front).
Rather than rely on column position, this locates the handful of metrics we
care about by matching header text, so it's resilient to those differences.

Re-run this script and commit the regenerated JSON whenever new KPI reports
come in:
  python3 scripts/export_kpi.py
"""

import csv
import json
import re
from pathlib import Path

BASE = (
    "/Users/eddiejoeantonio/Library/CloudStorage/OneDrive-SharedLibraries-HR&AAdvisors,Inc/"
    "Digital Opportunity - 260299 - MHM Broadband Infrastructure Mapping/"
    "3. Analysis/WS2/Client Data/Updated Data 08202026/2024-2026 KPI Reports"
)

# (period label, filename) in chronological order.
REPORTS = [
    ("2024 Mid-Year", "2024 Mid Year KPI Report.csv"),
    ("2024 Year-End", "2024 Year End KPT Report.csv"),
    ("2025 Mid-Year", "2025 Digital Equity Mid-Year_KPI Report .csv"),
    ("2025 Year-End", "NEW-2025 Digital Equity Year End_KPI Report.csv"),
    ("2026 Mid-Year", "2026 Digital Equity Mid-Year_KPI Report.csv"),
]

# field key -> header text to match (a column matches if its normalized
# header STARTS WITH this string). Order matters only for readability.
FIELDS = {
    "organization": "Organization Name",
    "individualsServed": "Number of individuals served",
    "outreachEvents": "Number of community outreach events conducted or attended for digital inclusion services promotion",
    "organizationsEngaged": "Number of organizations engaged for digital equity service promotion",
    "connectorsHired": "Number of individuals hired as Digital Connectors/Digital Navigators",
    "connectorsTrained": "Number of individuals trained as Digital Connectors/Digital Navigators",
    "connectorSessions": "Number of sessions conducted by Digital Connectors",
}


def normalize_header(cell):
    return re.sub(r"\s+", " ", (cell or "")).strip()


def to_int(value):
    if value is None:
        return None
    v = value.strip()
    if not v or not re.fullmatch(r"-?\d+", v):
        return None
    return int(v)


def find_header_row(rows):
    for i, row in enumerate(rows):
        for cell in row:
            if normalize_header(cell).startswith("Organization Name"):
                return i
    raise RuntimeError("Could not find a header row with 'Organization Name'")


def column_map(header_row):
    normalized = [normalize_header(c) for c in header_row]
    mapping = {}
    for key, prefix in FIELDS.items():
        for i, cell in enumerate(normalized):
            if cell.startswith(prefix):
                mapping[key] = i
                break
        else:
            raise RuntimeError(f"Could not find column for '{prefix}'")
    return mapping


def read_rows(path):
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, newline="", encoding=encoding) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Could not decode {path} with any known encoding")


def extract_period(path, period):
    rows = read_rows(path)
    header_idx = find_header_row(rows)
    cols = column_map(rows[header_idx])

    records = []
    for row in rows[header_idx + 1 :]:
        if len(row) <= cols["organization"]:
            continue
        org = row[cols["organization"]].strip()
        if not org:
            continue
        record = {"period": period}
        for key in FIELDS:
            if key == "organization":
                continue
            idx = cols.get(key)
            record[key] = to_int(row[idx]) if idx is not None and idx < len(row) else None
        records.append((org, record))
    return records


def main():
    by_org = {}
    for period, filename in REPORTS:
        path = Path(BASE) / filename
        for org, record in extract_period(path, period):
            by_org.setdefault(org, []).append(record)

    out_path = Path(__file__).resolve().parent.parent / "data" / "mhm-kpi.json"
    payload = {
        "periods": [p for p, _ in REPORTS],
        "orgs": by_org,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    total_records = sum(len(v) for v in by_org.values())
    print(f"Wrote {total_records} KPI records across {len(by_org)} organizations to {out_path}")


if __name__ == "__main__":
    main()
