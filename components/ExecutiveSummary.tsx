"use client";

import { useEffect, useRef, useState } from "react";
import type { PortfolioTotals } from "@/lib/data";

type StatCategory = {
  name: string;
  colorVar: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  stats: { value: string; label: string }[];
};

/** "Ecosystem partners" and "Tracked ecosystem relationships" are computed
 *  from the live region graphs (via `portfolioTotals`), not hardcoded, so
 *  they can't drift out of sync with what the ecosystem maps actually show
 *  the way a hand-maintained figure can. */
function buildCategories(portfolioTotals: PortfolioTotals): StatCategory[] {
  return [
    {
      name: "Portfolio",
      colorVar: "--cobalt",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      textClass: "text-[var(--cobalt)]",
      stats: [
        { value: "45", label: "Total organizations" },
        { value: "35", label: "Active grants (2026)" },
        { value: "10", label: "Historical/closed grants" },
        { value: String(portfolioTotals.partnerOrgCount), label: "Ecosystem partners" },
      ],
    },
    {
      name: "Funding",
      colorVar: "--teal",
      bgClass: "bg-teal-50",
      borderClass: "border-teal-200",
      textClass: "text-[var(--teal)]",
      stats: [
        { value: "$31.3M", label: "Digital equity funding awarded since 2024*" },
        { value: String(portfolioTotals.relationshipCount), label: "Tracked ecosystem relationships" },
      ],
    },
    {
      name: "Reach & Impact",
      colorVar: "--gold",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
      textClass: "text-[var(--gold)]",
      stats: [
        { value: "79K", label: "Individuals served since 2024" },
        { value: "33.1K", label: "Devices distributed" },
      ],
    },
  ];
}

function StatCard({
  value,
  label,
  category,
  index,
}: {
  value: string;
  label: string;
  category: StatCategory;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 60}ms` }}
      className={`rounded-xl border ${category.borderClass} ${category.bgClass} p-5 shadow-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-lg ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <p className={`text-3xl sm:text-4xl font-bold ${category.textClass} mb-1 tracking-tight`}>
        {value}
      </p>
      <p className="text-xs font-semibold text-[var(--raisin)] uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

export function ExecutiveSummary({ portfolioTotals }: { portfolioTotals: PortfolioTotals }) {
  const categories = buildCategories(portfolioTotals);
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Left side - Header and description */}
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Portfolio Snapshot
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Digital Access Impact
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Since 2024, MHM has supported 45 grantee organizations working
              on digital equity across its South Texas service area, 35
              with an active grant today and another 10 whose grants have
              since closed. These grantees don&apos;t work alone: the
              network they&apos;ve built out also includes{" "}
              {portfolioTotals.partnerOrgCount} partner organizations, from
              libraries and school districts to health clinics and
              community groups, connected through{" "}
              {portfolioTotals.relationshipCount} documented relationships
              across the region. That reach extends well beyond MHM&apos;s
              own grant dollars into a much wider regional ecosystem.
            </p>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Together, this network has served nearly 79,000 individuals
              since 2024, nearly tripling its first year&apos;s reach,
              largely by putting devices directly into people&apos;s hands:
              over 33,100 laptops, hotspots, smartphones, and other devices
              distributed to date.
            </p>
                        <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
      MHM continues to anchor, lead, and promote digital access services throughout the 74-county South Texas region. 
            </p>
          </div>

          {/* Right side - Categories */}
          <div className="space-y-10">
            {categories.map((category) => (
              <div key={category.name}>
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: `var(${category.colorVar})` }}
                  />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    {category.name}
                  </h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {category.stats.map((stat, index) => (
                    <StatCard
                      key={stat.label}
                      value={stat.value}
                      label={stat.label}
                      category={category}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground leading-relaxed">
              *Includes grants and donations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
