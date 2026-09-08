import { buildGraph, REGIONS } from "@/lib/data";
import Link from "next/link";

export default function HomePage() {
  const regions = REGIONS.map((region) => ({
    ...region,
    orgCount: buildGraph(region.code).nodes.length,
  }));

  return (
    <main className="h-full flex-1 overflow-y-auto">
      <section className="bg-[var(--raisin)] px-6 py-16 text-white sm:py-20">
        <div className="mx-auto w-full max-w-4xl">
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
        </div>
      </section>

      <section className="bg-secondary/40 px-6 py-10 sm:py-12">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose a region
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {regions.map((region) => (
              <Link
                key={region.code}
                href={`/regions/${region.code}`}
                className="group flex flex-col justify-between gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-primary/40"
              >
                <div>
                  <div className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary">
                    {region.label}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {region.orgCount} organization{region.orgCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
