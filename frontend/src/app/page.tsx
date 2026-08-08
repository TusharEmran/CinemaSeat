import Link from 'next/link';

import { ApiRequestError, getMovies } from '../api/client';
import { getMockMovies, getMockSynopsis } from '../api/mock';
import type { Movie } from '../api/types';

import { Hero } from '../components/Hero';
import { MovieSlider } from '../components/MovieSlider';

/*
 * Home page -- the cinema's marquee. Full-bleed hero with the featured film's
 * poster as cover, then an animated sliding carousel of all films.
 * Server-rendered so the FCP includes real poster imagery, not a spinner.
 */
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';

export default async function MoviesPage() {
  let movies: Movie[] = [];
  let loadError: string | null = null;
  let source: 'live' | 'mock' | 'none' = 'none';

  if (USE_MOCKS) {
    movies = getMockMovies();
    source = 'mock';
  } else {
    try {
      movies = await getMovies();
      source = movies.length > 0 ? 'live' : 'none';
    } catch (err) {
      loadError = err instanceof ApiRequestError ? err.message : 'Could not reach the cinema.';
    }
  }

  if (loadError) {
    return <LoadError message={loadError} />;
  }

  if (movies.length === 0) {
    return <EmptyState />;
  }

  const [featured, ...rest] = movies;
  const synopsis = USE_MOCKS ? getMockSynopsis(featured.id) : undefined;

  return (
    <>
      <Hero movie={featured} synopsis={synopsis} />

      {/* Now Showing — Animated Slider */}
      <section
        id="now-showing"
        aria-labelledby="now-showing-title"
        className="relative py-16 sm:py-24"
      >
        {/* Section header */}
        <header className="mb-8 mx-auto max-w-7xl px-5 sm:px-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-accent/40" aria-hidden="true" />
              <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
                In Cinemas
              </p>
            </div>
            <h2
              id="now-showing-title"
              className="font-display text-3xl sm:text-4xl text-ink font-bold"
            >
              Now Showing
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <p className="text-sm text-muted">
              {movies.length} {movies.length === 1 ? 'film' : 'films'}
            </p>
            {source === 'mock' && <MockBadge />}
          </div>
        </header>

        {/* Movie slider with all movies (including featured for full browsing) */}
        <MovieSlider movies={movies} />
      </section>

      {/* How it Works Section */}
      <HowItWorks />

      {/* Stats / Social Proof Banner */}
      <StatsBanner />

      {source === 'mock' && <MockNotice />}
    </>
  );
}

/* -- How It Works ---------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      icon: <BrowseIcon />,
      title: 'Browse & Pick',
      body: 'See every seat on the live map. Tap the ones you want -- no guessing, no surprises.',
    },
    {
      icon: <HoldIcon />,
      title: 'Hold & Verify',
      body: 'Selected seats are held for a few minutes while you verify your phone and review.',
    },
    {
      icon: <ConfirmIcon />,
      title: 'Pay & Confirm',
      body: 'Only confirmed payments book the seat. Until you pay, nothing is charged.',
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="relative border-t border-line"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-24">
        <header className="mb-12 text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8 bg-accent/40" aria-hidden="true" />
            <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
              How It Works
            </p>
            <span className="h-px w-8 bg-accent/40" aria-hidden="true" />
          </div>
          <h2
            id="how-it-works-title"
            className="font-display text-3xl sm:text-4xl text-ink mb-3 font-bold"
          >
            Three steps to your seat
          </h2>
          <p className="text-muted text-sm sm:text-base">
            No surprises at the door. You see the seat, you hold the seat, you pay for the seat.
          </p>
        </header>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="group relative rounded-2xl border border-line bg-white p-7 sm:p-8 transition-all duration-300 hover:border-accent/30 hover:shadow-[0_12px_40px_rgba(225,29,72,0.06)]"
            >
              {/* Step number accent */}
              <span className="absolute -top-3 left-6 inline-flex items-center justify-center h-6 w-6 rounded-full bg-accent text-white text-xs font-bold">
                {i + 1}
              </span>

              <div className="flex flex-col gap-4 pt-2">
                <div className="text-accent/60 group-hover:text-accent transition-colors duration-300">
                  {step.icon}
                </div>
                <h3 className="font-display text-xl text-ink font-semibold">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -- Stats Banner ---------------------------------------------------------- */

function StatsBanner() {
  const stats = [
    { value: '8', label: 'Films Now Showing' },
    { value: '3', label: 'Screens Available' },
    { value: '112', label: 'Seats per Screen' },
    { value: '5 min', label: 'Hold Window' },
  ];

  return (
    <section className="border-t border-b border-line bg-gradient-to-r from-rose-50/50 via-white to-blue-50/50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 text-center">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="font-display text-3xl sm:text-4xl text-accent font-bold tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -- Badges / Notices ------------------------------------------------------ */

function MockBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-accent font-semibold"
    >
      Demo
    </span>
  );
}

function MockNotice() {
  return (
    <div className="border-t border-line bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-6">
        <p className="text-xs sm:text-sm text-muted text-center">
          <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent mr-2 align-middle font-semibold">
            Mock
          </span>
          Sample catalog for the UI demo. Set{' '}
          <code className="rounded bg-surface-hi px-1.5 py-0.5 font-mono text-[11px] text-ink">
            NEXT_PUBLIC_USE_MOCKS=false
          </code>{' '}
          to use the live API.
        </p>
      </div>
    </div>
  );
}

/* -- Empty / Error States -------------------------------------------------- */

function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-danger">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-danger mb-2">Cinema is offline</p>
      <h1 className="font-display text-3xl text-ink mb-3 font-bold">
        We can&apos;t reach the box office
      </h1>
      <p className="text-muted mb-8">{message}</p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-6 py-2.5 text-sm font-medium text-ink hover:border-accent/30 hover:bg-accent-soft transition-colors duration-200 cursor-pointer shadow-sm"
      >
        Try again
      </a>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 ring-1 ring-line">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 4v16M17 4v16M2 9h20M2 15h20" stroke="currentColor" strokeWidth="0.8" />
        </svg>
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-accent mb-2">No films right now</p>
      <h1 className="font-display text-3xl text-ink mb-3 font-bold">Nothing on this week</h1>
      <p className="text-muted">
        The catalog is empty. New showtimes will appear here as soon as they are scheduled.
      </p>
    </div>
  );
}

/* -- Step Icons ------------------------------------------------------------ */

function BrowseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="26" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h26" stroke="currentColor" strokeWidth="1" />
      <circle cx="16" cy="18" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 27h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 23v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function HoldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8v8l5.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ConfirmIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M4 10a2 2 0 012-2h20a2 2 0 012 2v2.5a2.5 2.5 0 000 5V20a2 2 0 01-2 2H6a2 2 0 01-2-2v-2.5a2.5 2.5 0 000-5V10z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M12 8v14" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M19 13l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
