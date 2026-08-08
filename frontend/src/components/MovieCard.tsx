import Link from './AppLink';

import type { Movie } from '../api/types';

/*
 * Cinema-style movie card — white theme edition. The card floats on a white
 * surface with soft shadow. Hover lifts with a rose tint glow. Poster zooms
 * subtly. The entire card is a single Link for maximum tap target.
 */
export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link
      href={`/showtimes/${encodeURIComponent(movie.id)}`}
      aria-label={`See showtimes for ${movie.title}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(225,29,72,0.12),0_8px_20px_-8px_rgba(0,0,0,0.08)] hover:ring-accent/30"
    >
      {/* Poster */}
      <Poster movie={movie} />

      {/* Content */}
      <div className="relative flex flex-col gap-2.5 p-4 sm:p-5">
        {/* Title + Rating row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base sm:text-lg font-semibold leading-snug text-ink line-clamp-2 group-hover:text-accent transition-colors duration-300">
            {movie.title}
          </h3>
          {movie.rating && (
            <span className="shrink-0 mt-0.5 inline-flex items-center rounded-md bg-accent/8 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent font-semibold">
              {movie.rating}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted">
          {movie.runtime_minutes ? (
            <span className="flex items-center gap-1.5">
              <ClockIcon />
              {formatRuntime(movie.runtime_minutes)}
            </span>
          ) : null}
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <span className="flex items-center gap-1.5">
            <ScreenIcon />
            3 screens
          </span>
        </div>

        {/* CTA row */}
        <div className="mt-1 flex items-center justify-between">
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent uppercase tracking-wider opacity-70 group-hover:opacity-100 group-hover:gap-2.5 transition-all duration-300"
          >
            Book tickets
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              <path d="M2.5 6h7m0 0L6.5 3M9.5 6l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      {/* Bottom accent bar on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
    </Link>
  );
}

function Poster({ movie }: { movie: Movie }) {
  const ratioStyle: React.CSSProperties = {
    aspectRatio: '2 / 3',
  };

  if (movie.poster_url) {
    return (
      <div className="relative w-full overflow-hidden" style={ratioStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={movie.poster_url}
          alt={`Poster for ${movie.title}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        {/* Soft overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="poster-fallback relative flex h-full w-full items-center justify-center p-6"
      style={ratioStyle}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-display text-4xl font-bold leading-none text-accent/60 tracking-tight">
          {initials(movie.title)}
        </span>
        <span className="block h-px w-12 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted/50">CinemaSeat</span>
      </div>
    </div>
  );
}

function initials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(the|a|an)$/i.test(w));
  if (words.length === 0) return 'CS';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* Inline SVG icons */

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-muted">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
      <path d="M6 3.5V6L7.75 7.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-muted">
      <rect x="1" y="2" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="0.9" />
      <path d="M4 10h4M6 8v2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}