"use client";

import { CategoryLegend } from "@/components/CategoryLegend";
import { GranteeStatusSelect, type GranteeStatusFilter } from "@/components/GranteeStatusSelect";
import { Legend } from "@/components/Legend";
import { NetworkGraph } from "@/components/NetworkGraph";
import { RegionSelect } from "@/components/RegionSelect";
import { buildGraph, CATEGORIES, REGIONS } from "@/lib/data";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function NetworkExplorer({ initialRegion }: { initialRegion: string }) {
  const router = useRouter();
  const [regionCode, setRegionCode] = useState(initialRegion);
  const [granteeStatus, setGranteeStatus] = useState<GranteeStatusFilter>("all");
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(CATEGORIES));

  const graph = useMemo(() => buildGraph(regionCode), [regionCode]);
  const activeRegion = REGIONS.find((r) => r.code === regionCode);

  function handleRegionChange(code: string) {
    setRegionCode(code);
    router.replace(`/regions/${code}`);
  }

  const filteredGraph = useMemo(() => {
    const nodes = graph.nodes.filter(
      (n) =>
        selectedCategories.has(n.category) &&
        (granteeStatus === "all" || n.granteeStatus === granteeStatus),
    );
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
    return { nodes, links };
  }, [graph, selectedCategories, granteeStatus]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {activeRegion?.label}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          {filteredGraph.nodes.length} organizations serving residents
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[70vh] shrink-0 flex-col overflow-y-auto border-b border-border bg-secondary/40 md:h-full md:max-h-none md:w-72 md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="flex flex-col gap-5 px-4 py-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Region
              </h3>
              <RegionSelect regions={REGIONS} value={regionCode} onChange={handleRegionChange} />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Grantee Status
              </h3>
              <GranteeStatusSelect value={granteeStatus} onChange={setGranteeStatus} />
            </div>

            <div className="border-t border-border pt-4">
              <CategoryLegend selected={selectedCategories} onChange={setSelectedCategories} />
            </div>

            <div className="border-t border-border pt-4">
              <Legend />
            </div>
          </div>
        </aside>

        <div className="relative min-h-0 flex-1 p-4 sm:p-6">
          <NetworkGraph graph={filteredGraph} />
        </div>
      </div>
    </div>
  );
}
