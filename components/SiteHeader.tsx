import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            MHM
          </span>
          <span className="hidden text-sm text-muted-foreground md:inline">
            Regional Grantee &amp; Organization Network
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/methodology"
            className="shrink-0 rounded-full px-2.5 py-1.5 text-xs whitespace-nowrap text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:px-4 sm:py-2 sm:text-sm"
          >
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
