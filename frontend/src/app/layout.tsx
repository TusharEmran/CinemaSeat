import Link from '../components/AppLink';
import { Inter, Outfit } from 'next/font/google';

import './globals.css';

/*
 * Typography pairing: Outfit (geometric, modern display) for headings and
 * brand moments, Inter for body text. Both self-hosted by next/font —
 * no external requests, no layout shift.
 */
const display = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

export const metadata = {
  title: 'CinemaSeat — Pick your seat, not the surprise',
  description:
    'Reserve cinema seats for the latest releases. See exactly what is available, hold it for a few minutes while you check out, and only then pay.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      style={{
        ['--font-display' as never]: `var(--font-display-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
        ['--font-sans' as never]: `var(--font-sans-loaded), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
      }}
    >
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          aria-label="CinemaSeat home"
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <MarkLogo />
          <span className="font-display text-xl font-semibold tracking-tight text-ink group-hover:text-accent transition-colors duration-200">
            CinemaSeat
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-lg text-ink hover:text-accent hover:bg-accent-soft transition-colors duration-200 cursor-pointer"
          >
            Now showing
          </Link>
          <Link
            href="/#coming-soon"
            className="px-3.5 py-2 rounded-lg text-muted hover:text-ink hover:bg-surface-hi transition-colors duration-200 cursor-pointer"
          >
            Coming soon
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24 bg-surface">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
        <div className="flex flex-col gap-1">
          <p>
            <span className="font-display font-semibold text-ink">CinemaSeat</span> &middot; pick your seat, not the
            surprise.
          </p>
          <p className="text-xs">Seats held for a short window &middot; payment confirms a booking.</p>
        </div>
        <p className="text-xs text-muted/60">&copy; {new Date().getFullYear()} CinemaSeat</p>
      </div>
    </footer>
  );
}

/*
 * Inline SVG mark — a film-reel silhouette. The accent colour makes it pop
 * against the white header.
 */
function MarkLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className="text-accent"
    >
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="3.2" fill="currentColor" />
      <circle cx="14" cy="6" r="1.6" fill="currentColor" />
      <circle cx="22" cy="14" r="1.6" fill="currentColor" />
      <circle cx="14" cy="22" r="1.6" fill="currentColor" />
      <circle cx="6" cy="14" r="1.6" fill="currentColor" />
    </svg>
  );
}
