export const metadata = {
  title: "Methodology & Data Sources | MHM Regional Network",
};

function Source({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}

export default function MethodologyPage() {
  return (
    <main className="h-full flex-1 overflow-y-auto">
      <div className="container-wide py-10 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Methodology &amp; Data Sources
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          What this dashboard shows
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base border-b border-border pb-8">
          This dashboard is built from Methodist Healthcare Ministries&apos;
          (MHM) own tracking of its Digital Equity grantees and their
          partnerships. It turns that tracking into an interactive network
          so a region&apos;s collaboration landscape (who works with whom,
          how actively, and around what service) can be read at a glance
          instead of scanned row by row in a spreadsheet.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">
            Collaboration network
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            For each of MHM&apos;s designated regions across its 76-county
            South Texas service area, the network shows two kinds of
            organizations: an MHM Digital Equity{" "}
            <span className="font-medium text-foreground">grantee</span> and
            the{" "}
            <span className="font-medium text-foreground">
              partner organizations
            </span>{" "}
            it collaborates or shares funding with, each backed by a grant
            report, site-visit note, or public source. A region can also
            include{" "}
            <span className="font-medium text-foreground">
              Key Regional Players
            </span>
            , organizations MHM funds or considers notable in that region
            with no documented direct collaboration yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Each documented relationship carries a type (grantee
            collaboration vs. funding relationship), a strength rating
            (&quot;Strong/Active&quot; or &quot;Weak/Existing&quot;), a
            primary service category, and, for grantees, a funding amount
            and whether they hold an active 2026 MHM Digital Equity grant.
            Where the same relationship has been documented more than once,
            for example once in a mid-year survey and again at year end,
            the dashboard shows it as a single connection and uses whichever
            report describes the stronger relationship.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">
            Reading the network
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each region renders as a force-directed graph. Nodes pull
            toward organizations they&apos;re connected to and push away
            from everything else, so tightly collaborating clusters group
            together and unconnected organizations settle toward the
            edges. Node position carries no geographic meaning. It&apos;s
            purely a function of the graph&apos;s connections, not a map.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            An organization&apos;s grantee status, used for both the legend
            and the border weight below, is <strong>Current Grantee</strong>{" "}
            if it holds an active 2026 MHM Digital Equity grant,{" "}
            <strong>Past Grantee</strong> if it&apos;s an MHM grantee
            without that active flag, and <strong>Not a Grantee</strong> for
            an organization that only ever appears as a partner.
          </p>
          <ol className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Fill color</span>{" "}
              shows grantee status by default: whether an organization is a
              current grantee, a past grantee, or not a grantee. Switching the
              legend to &quot;Service Type&quot; recolors every node by its
              primary service category instead.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Border style
              </span>{" "}
              is solid if this is the only region where the organization
              (or, for a grantee, the grantee itself) is on record as
              operating, and dashed if it also operates in other regions,
              so this region is one of several rather than a single home
              base.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Border weight
              </span>{" "}
              is thicker for an MHM grantee and thinner for a partner
              organization that has never itself been an MHM grantee.
            </li>
            <li>
              <span className="font-medium text-foreground">Line style</span>{" "}
              is solid for a grantee collaboration and dashed for a funding
              relationship. Thicker, more opaque lines mark a
              &quot;Strong/Active&quot; relationship; thinner, lighter
              ones mark &quot;Weak/Existing.&quot;
            </li>
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            Clicking a node opens a panel with its category, grantee
            status, funding amount, active-grant status, KPI reporting (see
            below), and every documented connection in the current region.
            Clicking a connection in that list jumps to that
            organization&apos;s own node. Filters in the left panel narrow
            the graph to selected service categories or grantee statuses;
            anything filtered out disappears from the graph entirely, along
            with its connections.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">
            KPI reporting
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Grantees fill out a short survey each reporting period (a
            &quot;mid-year&quot; and a &quot;year-end&quot; survey), and
            those responses feed a &quot;KPI Reporting&quot; section in the
            organization panel for every grantee that has one on file: a
            lifetime total of individuals served, the most recently
            reported period&apos;s figure, and a period-by-period table
            covering individuals served, outreach events, and digital
            navigator sessions.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            These figures come in live, not from the same tracker export as
            the network itself, so a new survey submission can show up on
            the dashboard within the hour without anyone having to update
            anything by hand.
          </p>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground">
            Known limitations
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              &quot;Home region&quot; is inferred, not stated.
            </span>{" "}
            The tracker records a region for the organization side of a
            row and a separate region for the grantee side, but it
            doesn&apos;t flag a single one of those as an organization&apos;s
            permanent headquarters. This dashboard infers whether a region
            is an organization&apos;s home base by checking every row where
            it appears in that same role (as the grantee, or as the
            partner organization) and seeing whether they all point to one
            region or several. This can disagree with what someone
            familiar with the organization&apos;s actual footprint would
            say, particularly for an organization the tracker has only
            documented once or twice.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Region assignments can shift between tracker revisions.
            </span>{" "}
            The tracker has gone through multiple correction passes, so a
            relationship shown in one region here may have appeared in a
            different region in an earlier version of the analysis, as
            re-verification narrowed down an organization&apos;s actual
            location.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Funding amounts are the grantee&apos;s own total, not the
              partnership&apos;s.
            </span>{" "}
            The dollar figure shown for a grantee is its own reported MHM
            award (Digital Equity theme where available, otherwise the
            all-program total). It isn&apos;t attributable to any single
            partnership shown on the graph.
          </p>
        </section>
      </div>
    </main>
  );
}
