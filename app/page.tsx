import { HeroRegionPicker } from "@/components/HeroRegionPicker";
import { buildGraph, REGIONS } from "@/lib/data";

export default function HomePage() {
  const regions = REGIONS.map((region) => ({
    ...region,
    orgCount: buildGraph(region.code).nodes.length,
  }));

  return (
    <main className="h-full flex-1 overflow-y-auto">
      <section className="relative flex min-h-full flex-col justify-center overflow-hidden bg-[var(--raisin)] px-6 py-16 text-white sm:py-24">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-background.jpg)" }}
        />
        <div className="absolute inset-0 bg-[var(--raisin)]/80" />
        <div className="relative mx-auto w-full max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-widest text-white/60">
            MHM Digital Equity
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Regional Grantee &amp; Organization Network
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">
            An interactive map of how Methodist Healthcare Ministries&apos;
            Digital Equity grantees collaborate with partner organizations
            across its Texas service area — pick a region below to explore
            who works with whom, how actively, and around what service.
          </p>
          <HeroRegionPicker regions={regions} />
        </div>
      </section>
    </main>
  );
}
