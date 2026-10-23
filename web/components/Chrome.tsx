import Link from "next/link";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="2" y="9" width="22" height="15" rx="3" fill="#0f766e" />
        <rect x="8" y="3" width="10" height="9" rx="1.5" fill="#fff" stroke="#0f766e" strokeWidth="2" />
        <path d="M10.5 7.5l2 2 3.5-4" stroke="#0f766e" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      BallotScout
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="BallotScout home" className="rounded-md">
          <Logo />
        </Link>
        <span className="hidden text-sm text-slate-600 sm:inline">Nonpartisan voter guide</span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Nonpartisan. AI-generated summaries cite their sources; always verify with your official sample ballot.</p>
        <p className="shrink-0 font-medium text-slate-700">Built for Gator Hack V</p>
      </div>
    </footer>
  );
}
