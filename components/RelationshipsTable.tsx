"use client";

import { useMemo, useState } from "react";
import { OrganizationPanel } from "@/components/OrganizationPanel";
import { buildGraph, REGIONS } from "@/lib/data";
import { fuzzyKey, type OrgKpiSummary } from "@/lib/kpi";
import { relationshipStrengthLabel } from "@/lib/labels";
import type { GraphNode } from "@/lib/types";

interface RelationshipRow {
  regionCode: string;
  regionLabel: string;
  grantee: string;
  organization: string;
  relationshipType: string | null;
  relationshipStrength: string | null;
}

/** Same underlying data as the ecosystem maps (one row per grantee <->
 *  organization relationship, per region), shown as a plain table instead of
 *  a graph. Clicking either name opens the same detail panel the maps use. */
export function RelationshipsTable({ kpiMap }: { kpiMap: Record<string, OrgKpiSummary> }) {
  const [selected, setSelected] = useState<{ regionCode: string; name: string } | null>(null);

  const { rows, nodesByRegion } = useMemo(() => {
    const rows: RelationshipRow[] = [];
    const nodesByRegion = new Map<string, Map<string, GraphNode>>();
    for (const region of REGIONS) {
      const graph = buildGraph(region.code);
      nodesByRegion.set(region.code, new Map(graph.nodes.map((n) => [n.id, n])));
      for (const link of graph.links) {
        rows.push({
          regionCode: region.code,
          regionLabel: region.label,
          grantee: link.source,
          organization: link.target,
          relationshipType: link.relationshipType,
          relationshipStrength: link.relationshipStrength,
        });
      }
    }
    rows.sort(
      (a, b) => a.grantee.localeCompare(b.grantee) || a.organization.localeCompare(b.organization),
    );
    return { rows, nodesByRegion };
  }, []);

  const [regionFilter, setRegionFilter] = useState("all");
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (regionFilter === "all" || row.regionCode === regionFilter) &&
        (!q || row.grantee.toLowerCase().includes(q) || row.organization.toLowerCase().includes(q)),
    );
  }, [rows, regionFilter, query]);

  const selectedNode = useMemo(() => {
    if (!selected) return null;
    const node = nodesByRegion.get(selected.regionCode)?.get(selected.name);
    if (!node) return null;
    return { ...node, kpi: kpiMap[fuzzyKey(node.id)] ?? null };
  }, [selected, nodesByRegion, kpiMap]);

  return (
    <div className="relative">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-gray-600">
          Region
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--raisin)]"
          >
            <option value="all">All regions</option>
            {REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-gray-600">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Grantee or organization name"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--raisin)]"
          />
        </label>
        <p className="text-sm text-gray-500 sm:pb-2" aria-live="polite">
          {visibleRows.length} of {rows.length} relationships
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">MHM Grantee</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Relationship Type</th>
              <th className="px-4 py-3">Strength</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No relationships match these filters.
                </td>
              </tr>
            )}
            {visibleRows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{row.regionLabel}</td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSelected({ regionCode: row.regionCode, name: row.grantee })}
                    className="text-left font-medium text-[var(--cobalt)] hover:underline"
                  >
                    {row.grantee}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSelected({ regionCode: row.regionCode, name: row.organization })}
                    className="text-left font-medium text-[var(--cobalt)] hover:underline"
                  >
                    {row.organization}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{row.relationshipType ?? "Not specified"}</td>
                <td className="px-4 py-2.5 text-gray-600">
                  {relationshipStrengthLabel(row.relationshipStrength)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedNode && (
        <OrganizationPanel
          node={selectedNode}
          onClose={() => setSelected(null)}
          onSelectConnection={(id) => setSelected({ regionCode: selected!.regionCode, name: id })}
          className="fixed top-20 right-4 bottom-4 w-72 sm:w-80"
        />
      )}
    </div>
  );
}
