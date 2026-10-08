"use client";

import { useRef } from "react";
import Link from "next/link";
import { HeroRegionPicker } from "@/components/HeroRegionPicker";
import { RegionMap } from "@/components/RegionMap";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { buildGraph, getPortfolioTotals, REGIONS } from "@/lib/data";

export default function HomePage() {
  const findingsRef = useRef<HTMLElement>(null);

  const regions = REGIONS.map((region) => ({
    ...region,
    orgCount: buildGraph(region.code).nodes.length,
  }));
  const portfolioTotals = getPortfolioTotals();

  const scrollToFindings = () => {
    findingsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="h-full flex-1 overflow-y-auto">
      {/* Split Hero Section */}
      <section className="relative flex min-h-screen flex-col border-b border-border lg:flex-row">
        {/* Image - shown above content on mobile, on the right on desktop */}
        <div className="relative order-first h-56 w-full sm:h-72 lg:order-last lg:h-screen lg:flex-1">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/images/hero-background.jpg)" }}
          />
        </div>

        {/* Left side - Content */}
        <div className="flex flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
          <div className="w-full max-w-xl">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--cobalt)]">
              MHM Digital Equity
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Regional Grantee &amp; Organization Network
            </h1>
            <p className="mt-6 max-w-lg text-sm sm:text-base text-muted-foreground leading-relaxed">
              MHM supports an impactful network of regional grantees and organizations across its South Texas service area. Scroll below to learn more about how MHM is supporting important digital access work in the region.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                onClick={scrollToFindings}
                className="rounded-lg bg-[var(--cobalt)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#2E3DB8] sm:px-8"
              >
                Impact Snapshot 
              </button>
              <Link
                href="/regions/A"
                className="rounded-lg border-2 border-[var(--cobalt)] px-6 py-3 font-semibold text-[var(--cobalt)] transition-colors hover:bg-[var(--cobalt)] hover:text-white sm:px-8 text-center"
              >
                View Ecosystems
              </Link>
              <Link
                href="/data"
                className="rounded-lg border-2 border-[var(--cobalt)] px-6 py-3 font-semibold text-[var(--cobalt)] transition-colors hover:bg-[var(--cobalt)] hover:text-white sm:px-8 text-center"
              >
                View Data
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Findings Section */}
      <section ref={findingsRef}>
        <ExecutiveSummary portfolioTotals={portfolioTotals} />
      </section>

      {/* Ecosystem Diagrams Section */}
      <section className="bg-[var(--raisin)] px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="container-wide">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            {/* Left side - Text */}
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/60">
                Explore the Network
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
                Interactive Regional Ecosystem Maps
              </h2>
              <p className="mt-4 text-sm sm:text-base text-white/80 leading-relaxed">
                An interactive map of how Methodist Healthcare Ministries&apos;
                Digital Equity grantees collaborate with partner organizations
                across its Texas service area — pick a region below to explore
                who works with whom, how actively, and around what service.
              </p>
            </div>

            {/* Right side - Region Picker */}
            <div>
              <HeroRegionPicker regions={regions} />
              <p className="mt-4 text-xs text-white/50">
                Prefer a map? Click any region on the map below.
              </p>
            </div>
          </div>

          {/* Interactive map */}
          <div className="mt-12">
            <RegionMap regions={regions} />
          </div>
        </div>
      </section>
    </main>
  );
}
