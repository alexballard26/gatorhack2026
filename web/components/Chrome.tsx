import Link from "next/link";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-sans text-lg font-bold tracking-tight text-ink">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#7CF29A" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5.5" stroke="#365248" strokeWidth="1.2" />
        <path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="#7CF29A" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2" fill="#7CF29A" />
      </svg>
      Undervote
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link href="/" aria-label="Undervote home" className="rounded-[4px]">
          <Logo />
        </Link>
        <span className="hidden rounded-chip border border-line-strong px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted md:inline">
          Nonpartisan voter intelligence
        </span>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="rounded-[4px] border border-transparent px-3 py-2 font-mono text-sm text-muted no-underline hover:border-line-strong hover:text-ink"
          >
            Find my ballot
          </Link>
          <Link
            href="/#how"
            className="hidden rounded-[4px] border border-transparent px-3 py-2 font-mono text-sm text-muted no-underline hover:border-line-strong hover:text-ink sm:inline-block"
          >
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-4 py-6 font-mono text-[12.5px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-3xl">
          Undervote is nonpartisan and unaffiliated with any campaign or party. AI-generated summaries cite their sources; always verify with your official sample ballot.
        </p>
        <p className="shrink-0 text-ink">Built for Gator Hack V</p>
      </div>
    </footer>
  );
}
