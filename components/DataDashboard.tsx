"use client";

import { useState } from "react";
import { RelationshipsTable } from "@/components/RelationshipsTable";
import { reportData } from "@/lib/report-data";
import type { EcosystemKpiTotals, OrgKpiSummary } from "@/lib/kpi";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type DataView = "charts" | "relationships";

const COLORS = ["#3C4ED6", "#5563E1", "#7080E8", "#8B9DEF", "#A6BAF6"];
const COLORS_ACCENT = ["#FF6B6B", "#FFA550", "#FFD93D", "#6BCB77", "#4D96FF"];

const DE_AWARDED_BY_YEAR = [
  { year: "2020", amount: 175000 },
  { year: "2021", amount: 185000 },
  { year: "2022", amount: 434544 },
  { year: "2023", amount: 4040860 },
  { year: "2024", amount: 10570931 },
  { year: "2025", amount: 10777175 },
  { year: "2026", amount: 9938777 },
];

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatDollars = (value: number) => `$${value.toLocaleString("en-US")}`;
const formatTooltipNumber = (value: unknown) =>
  typeof value === "number" ? value.toLocaleString("en-US") : String(value);

function LiveBadge() {
  return (
    <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 align-middle">
      <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
      Live from submissions
    </span>
  );
}

export function DataDashboard({
  live,
  kpiMap,
}: {
  live: EcosystemKpiTotals | null;
  kpiMap: Record<string, OrgKpiSummary>;
}) {
  const [view, setView] = useState<DataView>("charts");

  // Sections wired to Airtable fall back to the static report snapshot if the
  // live fetch fails or returns nothing, so the page never renders empty.
  const hasLive = (series?: EcosystemKpiTotals["individualsServed"]) =>
    !!series && series.timeline.length > 0;

  const servedLive = hasLive(live?.individualsServed);
  const servedTimeline = servedLive ? live!.individualsServed.timeline : reportData.individualsServed.timeline;
  const servedTotal = servedLive ? live!.individualsServed.total : reportData.individualsServed.totalServed;
  const servedMissing = servedLive ? live!.individualsServed.missingPeriods ?? [] : [];

  const outreachLive = hasLive(live?.outreachEvents);
  const outreachTimeline = outreachLive ? live!.outreachEvents.timeline : reportData.programEngagement.communityOutreachEvents;
  const outreachTotal = outreachLive ? live!.outreachEvents.total : reportData.programEngagement.totalOutreachEvents;

  const partnerLive = hasLive(live?.partnerOrganizations);
  const partnerTimeline = partnerLive ? live!.partnerOrganizations.timeline : reportData.programEngagement.partnerOrganizationsEngaged;
  const partnerTotal = partnerLive ? live!.partnerOrganizations.total : reportData.programEngagement.totalPartnerEngagements;

  return (
    <main className="bg-gray-50">
      <div className="container-wide py-10 sm:py-14">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-600">
            Data &amp; Ecosystem Analysis
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--raisin)] sm:text-4xl">
            MHM Digital Equity Ecosystem Analysis
          </h1>
          <p className="mt-4 text-sm sm:text-base text-gray-600">
            Complete data from the August 2026 ecosystem mapping analysis, covering grantee relationships, reach, and impact.
          </p>
          <p className="mt-5 flex items-center gap-3 rounded-lg border border-[var(--cobalt)] bg-white px-4 py-3 text-sm font-medium text-[var(--raisin)] md:hidden">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--cobalt)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="2" width="10" height="20" rx="2" transform="rotate(90 12 12)" />
            </svg>
            On a phone, turn it sideways to landscape view for the best experience.
          </p>
        </div>

        {/* View toggle */}
        <div className="mb-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-sm w-fit">
          <button
            type="button"
            onClick={() => setView("charts")}
            aria-pressed={view === "charts"}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              view === "charts" ? "bg-[var(--cobalt)] text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Charts
          </button>
          <button
            type="button"
            onClick={() => setView("relationships")}
            aria-pressed={view === "relationships"}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              view === "relationships" ? "bg-[var(--cobalt)] text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Relationships Table
          </button>
        </div>

        {view === "relationships" && (
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
              Grantee &amp; Organization Relationships
            </h2>
            <p className="text-gray-600 mb-6">
              The same relationships shown in the ecosystem maps, one row per
              grantee-organization pair. Click a name to open its detail
              panel.
            </p>
            <RelationshipsTable kpiMap={kpiMap} />
          </section>
        )}

        {view === "charts" && (
          <>
        {/* Portfolio Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-6">
            Portfolio Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">45</p>
              <p className="text-sm font-medium text-gray-700 uppercase tracking-wide">Total Organizations</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">35</p>
              <p className="text-sm font-medium text-gray-700 uppercase tracking-wide">Active Grants (2026)</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">10</p>
              <p className="text-sm font-medium text-gray-700 uppercase tracking-wide">Historical/Closed Grants</p>
            </div>
          </div>
        </section>

        {/* Organizations by Primary Service */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Organizations by Primary Service
          </h2>
          <p className="text-gray-600 mb-8">
            Education, digital equity, and health are the three largest primary service categories of the 45-organization portfolio.
          </p>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reportData.organizationsByService}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={formatNumber} />
                <YAxis dataKey="service" type="category" width={230} tick={{ fontSize: 12 }} />
                <Tooltip formatter={formatTooltipNumber} />
                <Bar dataKey="count" fill="#3C4ED6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Organizations by Geography */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Organizations by Geography
          </h2>
          <p className="text-gray-600 mb-8">
            While San Antonio Metropolitan Statistical Area has the largest concentration of grantees, the portfolio's reach extends to rural counties and along the border.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reportData.organizationsByGeography}
                margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatNumber} width={64} />
                <Tooltip formatter={formatTooltipNumber} />
                <Bar dataKey="count" fill="#6BCB77" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Total Funding Trends */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            DE Total Awarded
          </h2>
          <p className="text-gray-600 mb-8">
            Digital equity awards grew from under $0.5 million a year before 2023 to over $10 million a year in 2024 and 2025, for $31.3 million awarded from 2024 to 2026.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DE_AWARDED_BY_YEAR}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`} width={64} />
                <Tooltip formatter={(value) => (typeof value === "number" ? formatDollars(value) : String(value))} />
                <Bar dataKey="amount" name="Awarded" fill="#3C4ED6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
              <p className="mt-4 text-xs text-gray-500">
                Amounts include grants and donations.
              </p>
        </section>

        {/* MHM Total Funding Context */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Total MHM Funding
          </h2>
          <p className="text-gray-600 mb-8">
            Digital Equity is still a relatively small, recent slice of a much larger health-focused portfolio, making up about 7% of MHM's funded universe.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">$1.19B</p>
              <p className="text-sm font-medium text-gray-700">Awarded across 3,108 grants to 528 organizations since 1996</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">$249M</p>
              <p className="text-sm font-medium text-gray-700">Awarded from 2021-2025 across 430 orgs</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-[var(--cobalt)] mb-2">$43.9M</p>
              <p className="text-sm font-medium text-gray-700">Awarded to organizations in a rural county</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <p className="text-3xl font-bold text-[#6BCB77] mb-2">$31.3M</p>
              <p className="text-sm font-medium text-gray-700">Digital equity funding awarded since 2024</p>
              <p className="text-xs text-gray-500 mb-4">(Includes grants and donations)</p>
              <p className="text-2xl font-bold text-[#6BCB77]">7%</p>
              <p className="text-sm font-medium text-gray-700">Of all MHM organizations funded</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <p className="text-3xl font-bold text-[#6BCB77] mb-2">34</p>
              <p className="text-sm font-medium text-gray-700">Active grant organizations</p>
            </div>
          </div>
        </section>

        {/* Individuals Served */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Individuals Served
            {servedLive && <LiveBadge />}
          </h2>
          <p className="text-gray-600 mb-8">
            Despite representing a small share of MHM's overall spending, digital equity programs are serving a growing number of individuals, with totals more than tripling from the first half of 2024 to year-end.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Individuals Served</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={servedTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatNumber} width={64} />
                    <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
                    <Bar dataKey="count" fill="#3C4ED6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                <strong className="text-[var(--raisin)]">{servedTotal.toLocaleString()}</strong> total individuals served across reported periods
              </p>
              {servedMissing.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {servedMissing.join(", ")} not shown. The reporting form for that period did not ask for a total number of individuals served.
                </p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Demographic Trends</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="font-semibold text-[var(--raisin)] mb-1">Hispanic/Latino Residents</p>
                  <p className="text-sm text-gray-600">{reportData.individualsServed.demographics.hispanicLatino} of participants</p>
                  <p className="text-xs text-gray-500 mt-2">Where reported, Hispanic/Latino residents are consistently the largest group served</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="font-semibold text-[var(--raisin)] mb-1">Household Income</p>
                  <p className="text-sm text-gray-600">{reportData.individualsServed.demographics.householdIncomeUnder35k} under $35,000</p>
                  <p className="text-xs text-gray-500 mt-2">Household income skews low where reported</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Device Distribution */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Device Distribution
          </h2>
          <p className="text-gray-600 mb-8">
            Device distribution has fluctuated year to year, peaking at nearly 14,000 units in 2024 year-end before settling to roughly 10,000 in the latest period.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.deviceDistribution.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatNumber} width={64} />
                <Tooltip formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} />
                <Bar dataKey="count" fill="#FF6B6B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            <strong className="text-[var(--raisin)]">{reportData.deviceDistribution.totalDevices.toLocaleString()}</strong> total devices distributed across all reported periods
          </p>
        </section>

        {/* Program Engagement */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Program Engagement
            {(outreachLive || partnerLive) && <LiveBadge />}
          </h2>
          <p className="text-gray-600 mb-8">
            Grantees are hosting more outreach events while working with a smaller, more consistent set of partner organizations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Community Outreach Events</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={outreachTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatNumber} width={64} />
                    <Tooltip formatter={formatTooltipNumber} />
                    <Bar dataKey="count" fill="#FFA550" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                <strong className="text-[var(--raisin)]">{outreachTotal.toLocaleString()}</strong> total outreach events across reported periods
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Partner Organizations Engaged</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partnerTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatNumber} width={64} />
                    <Tooltip formatter={formatTooltipNumber} />
                    <Bar dataKey="count" fill="#6BCB77" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                <strong className="text-[var(--raisin)]">{partnerTotal.toLocaleString()}</strong> total partner-organization engagements across reported periods
              </p>
            </div>
          </div>
        </section>

        {/* Collaboration Network */}
        <section className="mb-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-[var(--raisin)] mb-2">
            Collaboration Network
          </h2>
          <p className="text-gray-600 mb-8">
            64 tracked relationships link 29 organizations, with most organizations naming a partner without mutual confirmation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Relationship Types</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "One-Directional", value: 46 },
                        { name: "Confirmed - Mutual", value: 18 }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#3C4ED6" />
                      <Cell fill="#A0AEC0" />
                    </Pie>
                    <Tooltip formatter={formatTooltipNumber} />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(value, entry) =>
                        `${value}: ${(entry.payload as { value?: number } | undefined)?.value ?? ""}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--raisin)] mb-4">Most Connected Organizations</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {reportData.collaborationNetwork.mostConnectedOrganizations.map((org, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">{org.org}</span>
                    <span className="inline-block bg-[var(--cobalt)] text-white text-xs font-bold px-3 py-1 rounded-full">
                      {org.connections}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--raisin)]">Key Patterns</h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-[var(--raisin)] text-sm mb-2">DigitalLIFT is a central hub</p>
              <p className="text-sm text-gray-600">
                {reportData.collaborationNetwork.relationshipPatterns.digitalLiftAsHub}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-[var(--raisin)] text-sm mb-2">Reach extends beyond grantees</p>
              <p className="text-sm text-gray-600">
                {reportData.collaborationNetwork.relationshipPatterns.relationshipsExtendBeyondGrantees}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-[var(--raisin)] text-sm mb-2">Mutual partnerships are rare</p>
              <p className="text-sm text-gray-600">
                {reportData.collaborationNetwork.relationshipPatterns.mutualPartnershipsRare}
              </p>
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-[var(--raisin)] mb-8">
            Data Sources & Methodology
          </h2>
          <p className="text-gray-600 mb-8">
            HR&A's analysis of MHM's grantee portfolio draws on six MHM data sources, spanning narrative reports, quantitative KPI exports, and the Fluxx grant roster.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-[var(--cobalt)] mb-3">Year-End Report PDFs</h3>
              <p className="text-2xl font-bold text-[var(--raisin)] mb-2">20 grantees</p>
              <p className="text-xs uppercase tracking-wide text-gray-600">2024</p>
              <p className="text-xs text-gray-600 mt-3">Individual narrative PDFs including grant finance summaries</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-[var(--cobalt)] mb-3">Fluxx Progress Reports</h3>
              <p className="text-2xl font-bold text-[var(--raisin)] mb-2">20-34 grantees</p>
              <p className="text-xs uppercase tracking-wide text-gray-600">2024-2026</p>
              <p className="text-xs text-gray-600 mt-3">Progress Reports consolidated in excel reports</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-[var(--cobalt)] mb-3">KPI Data Exports</h3>
              <p className="text-2xl font-bold text-[var(--raisin)] mb-2">19-34 grantees</p>
              <p className="text-xs uppercase tracking-wide text-gray-600">2024-2025</p>
              <p className="text-xs text-gray-600 mt-3">4 CSV exports highlighting reach, skills, and devices</p>
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </main>
  );
}
