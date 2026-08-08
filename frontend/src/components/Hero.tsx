import Link from './AppLink';

import type { Movie } from '../api/types';

export function Hero({ movie, synopsis }: { movie: Movie; synopsis?: string }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative min-h-[85vh] flex items-end overflow-hidden"
    >
      {/* Full-bleed poster background */}
      {movie.poster_url && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={movie.poster_url}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        </div>
      )}

      {/* Fallback gradient when no poster */}
      {!movie.poster_url && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-rose-100 via-slate-50 to-blue-50"
          aria-hidden="true"
        />
      )}

      {/* Multi-layer gradient overlays for text readability on white theme */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-transparent"
        aria-hidden="true"
      />
      {/* Extra bottom density so text is always readable */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[50%] bg-gradient-to-t from-white via-white/90 to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative mx-auto max-w-7xl w-full px-5 sm:px-8 pb-16 sm:pb-24 pt-40">
        <div className="max-w-2xl flex flex-col gap-5">
          {/* Label pill */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Now Showing
            </span>
            {movie.rating && (
              <span className="rounded-md bg-ink/8 backdrop-blur-sm px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink/70 font-semibold">
                {movie.rating}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            id="hero-title"
            className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-ink font-bold"
          >
            {movie.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted">
            {movie.runtime_minutes && (
              <span className="flex items-center gap-1.5">
                <ClockIcon />
                {formatRuntime(movie.runtime_minutes)}
              </span>
            )}
            {movie.runtime_minutes && <span className="h-3.5 w-px bg-ink/15" aria-hidden="true" />}
            <span className="flex items-center gap-1.5">
              <FilmIcon />
              Star Cineplex
            </span>
          </div>

          {/* Synopsis */}
          {synopsis && (
            <p className="text-base sm:text-lg text-ink/60 leading-relaxed max-w-xl">
              {synopsis}
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Link
              href={`/showtimes/${encodeURIComponent(movie.id)}`}
              className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white hover:bg-accent-hi hover:shadow-[0_8px_30px_rgba(225,29,72,0.3)] transition-all duration-300 cursor-pointer"
            >
              <TicketIcon />
              Book Now
              <ArrowRight />
            </Link>
            <a
              href="#now-showing"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white/70 backdrop-blur-sm px-6 py-3.5 text-sm font-medium text-ink hover:bg-white hover:border-accent/30 transition-all duration-300 cursor-pointer shadow-sm"
            >
              Browse all films
            </a>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" aria-hidden="true" />
    </section>
  );
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
      <path
        d="M3 8h10m0 0L9 4m4 4L9 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-muted">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4v3l2.2 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-muted">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 2.5v9M9.5 2.5v9M1.5 5.5h11M1.5 8.5h11" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 5.5A1.5 1.5 0 013.5 4h9A1.5 1.5 0 0114 5.5v1a1.5 1.5 0 010 3v1a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 10.5v-1a1.5 1.5 0 010-3v-1z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M6 4v8" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
    </svg>
  );
}