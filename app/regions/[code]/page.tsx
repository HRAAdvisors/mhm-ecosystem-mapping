import { NetworkExplorer } from "@/components/NetworkExplorer";
import { REGIONS } from "@/lib/data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return REGIONS.map((region) => ({ code: region.code }));
}

export default async function RegionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const region = REGIONS.find((r) => r.code === code.toUpperCase());
  if (!region) notFound();

  return <NetworkExplorer initialRegion={region.code} />;
}
