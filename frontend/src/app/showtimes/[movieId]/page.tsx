import Link from 'next/link';

import { ApiRequestError, getMovies, getShowtimes } from '../../../api/client';
import { getMockMovies, getMockShowtimes } from '../../../api/mock';
import type { Movie, Showtime } from '../../../api/types';

import { formatMinor } from '../../../api/types';

/*
 * Showtimes for one movie — white theme edition.
 * Grouped by theatre and screen with clean cards.
 */

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';

interface PageProps {
  params: Promise<{ movieId: string }>;
}

export default async function ShowtimesPage({ params }: PageProps) {
  const { movieId } = await params;

  let movie: Movie | null = null;
  let showtimes: Showtime[] = [];
  let source: 'live' | 'mock' | 'none' = 'none';
  let loadError: string | null = null;

  if (USE_MOCKS) {
    movie = getMockMovies().find((m) => m.id === movieId) ?? null;
    showtimes = movie ? getMockShowtimes(movieId) : [];
    source = movie ? 'mock' : 'none';
  } else {
    try {
      const all = await getMovies();
      movie = all.find((m) => m.id === movieId) ?? null;
      if (movie) {
        showtimes = await getShowtimes(movieId);
      }
      source = 'live';
    } catch (err) {
      loadError = err instanceof ApiRequestError ? err.message : 'Could not load showtimes.';
    }
  }

  if (loadError) {
    return <LoadError message={loadError} />;
  }

  if (!movie) {
    return <NotFound />;
  }

  const grouped = groupShowtimes(showtimes);

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
      <Breadcrumb movieTitle={movie.title} />

      <FilmHeader movie={movie} source={source} />

      {showtimes.length === 0 ? (
        <EmptyShowtimes />
      ) : (
        <ShowtimeGroups groups={grouped} />
      )}

      <Legend />
    </div>
  );
}

/* -- Sub-blocks ------------------------------------------------------------ */

function Breadcrumb({ movieTitle }: { movieTitle: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/" className="hover:text-accent transition-colors duration-200">
            Films
          </Link>
        </li>
        <li aria-hidden="true">&gt;</li>
        <li className="text-ink font-medium" aria-current="page">
          {movieTitle}
        </li>
      </ol>
    </nav>
  );
}

function FilmHeader({ movie, source }: { movie: Movie; source: 'live' | 'mock' | 'none' }) {
  return (
    <header className="mt-6 mb-10 flex flex-col sm:flex-row gap-6 sm:gap-8 sm:items-end">
      <Poster movie={movie} />

      <div className="flex flex-col gap-3 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Now showing</p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1.05] tracking-tight font-bold">
          {movie.title}
        </h1>
        <MetaRow movie={movie} />

        {source === 'mock' && (
          <p className="text-xs text-muted mt-2">
            <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent mr-2 align-middle font-semibold">
              Demo
            </span>
            Sample times for the UI demo. Set{' '}
            <code className="rounded bg-surface-hi px-1.5 py-0.5 font-mono text-[11px] text-ink">
              NEXT_PUBLIC_USE_MOCKS=false
            </code>{' '}
            to use the live API.
          </p>
        )}
      </div>
    </header>
  );
}

function Poster({ movie }: { movie: Movie }) {
  const ratioStyle: React.CSSProperties = { aspectRatio: '2 / 3' };

  if (movie.poster_url) {
    return (
      <div
        className="relative shrink-0 w-32 sm:w-44 overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.15)]"
        style={ratioStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={movie.poster_url}
          alt={`Poster for ${movie.title}`}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="poster-fallback relative shrink-0 w-32 sm:w-44 rounded-2xl border border-line flex items-center justify-center"
      style={ratioStyle}
      aria-hidden="true"
    >
      <span className="font-display text-3xl text-accent/70 tracking-tight font-bold">
        {initials(movie.title)}
      </span>
    </div>
  );
}

function MetaRow({ movie }: { movie: Movie }) {
  const parts: string[] = [];
  if (movie.rating) parts.push(movie.rating);
  if (movie.runtime_minutes) parts.push(formatRuntime(movie.runtime_minutes));

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden="true" className="h-3 w-px bg-line" />}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

/* -- Showtimes ------------------------------------------------------------- */

interface Group {
  theatre: string;
  screen: string;
  items: Showtime[];
}

function groupShowtimes(showtimes: Showtime[]): Group[] {
  const byVenue = new Map<string, Group>();

  for (const s of showtimes) {
    const key = `${s.theatre.name}::${s.theatre.screen}`;
    const existing = byVenue.get(key);
    if (existing) {
      existing.items.push(s);
    } else {
      byVenue.set(key, { theatre: s.theatre.name, screen: s.theatre.screen, items: [s] });
    }
  }

  // Sort each venue's shows by start time so the earliest is first.
  for (const g of byVenue.values()) {
    g.items.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  }

  return Array.from(byVenue.values()).sort((a, b) => a.theatre.localeCompare(b.theatre));
}

function ShowtimeGroups({ groups }: { groups: Group[] }) {
  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <section key={`${group.theatre}-${group.screen}`} aria-label={`${group.theatre} ${group.screen}`}>
          <header className="mb-4 flex items-end justify-between gap-3 border-b border-line pb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">{group.theatre}</p>
              <h2 className="font-display text-xl text-ink mt-0.5 font-semibold">{group.screen}</h2>
            </div>
            <p className="text-xs text-muted hidden sm:block">
              {group.items.length} {group.items.length === 1 ? 'show' : 'shows'}
            </p>
          </header>

          <ul role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {group.items.map((s) => (
              <ShowtimeCard key={s.id} showtime={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ShowtimeCard({ showtime }: { showtime: Showtime }) {
  const date = new Date(showtime.starts_at);
  const valid = !Number.isNaN(date.getTime());

  const dayLabel = valid
    ? date.toLocaleDateString(undefined, { weekday: 'short' })
    : '-';
  const dayNumber = valid ? date.getDate() : '-';
  const monthLabel = valid ? date.toLocaleDateString(undefined, { month: 'short' }) : '-';
  const timeLabel = valid
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '-';

  const isPremiere = showtime.base_price_minor >= 70000;

  return (
    <li>
      <Link
        href={`/seats/${encodeURIComponent(showtime.id)}`}
        aria-label={`Pick seats for ${showtime.theatre.name} ${showtime.theatre.screen} at ${timeLabel}`}
        className="group block rounded-2xl border border-line bg-white p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_12px_40px_-12px_rgba(225,29,72,0.1)] cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <DateBlock dayLabel={dayLabel} dayNumber={String(dayNumber)} monthLabel={monthLabel} />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <p className="font-display text-lg text-ink leading-tight group-hover:text-accent transition-colors duration-200 font-semibold">
              {timeLabel}
            </p>
            <p className="text-xs text-muted">From {formatMinor(showtime.base_price_minor)}</p>
            {isPremiere && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent font-semibold">
                Premiere
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function DateBlock({
  dayLabel,
  dayNumber,
  monthLabel,
}: {
  dayLabel: string;
  dayNumber: string;
  monthLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-bg px-2 py-1.5 min-w-[52px] ring-1 ring-line">
      <span className="text-[10px] uppercase tracking-wider text-muted leading-none">{dayLabel}</span>
      <span className="font-display text-xl text-ink leading-tight tabular-nums font-bold">{dayNumber}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted leading-none">{monthLabel}</span>
    </div>
  );
}

/* -- States ---------------------------------------------------------------- */

function EmptyShowtimes() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">No upcoming shows</p>
      <h2 className="font-display text-xl text-ink mt-2 mb-2 font-semibold">Check back tomorrow</h2>
      <p className="text-sm text-muted max-w-md mx-auto">
        New showtimes are added overnight. If you&apos;d like to be notified, pick the film again from
        the home page and we&apos;ll show the freshest schedule.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent/30 hover:bg-accent-soft transition-colors duration-200 cursor-pointer shadow-sm"
      >
        Back to films
      </Link>
    </div>
  );
}

function Legend() {
  return (
    <section className="mt-14 border-t border-line pt-8">
      <h2 className="font-display text-xl text-ink mb-3 font-semibold">Before you book</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted leading-relaxed">
        <li className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Pick a show, then a seat</p>
          <p>Showtimes list the screen&apos;s starting price. Seats inside the screen vary by row.</p>
        </li>
        <li className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Held for a few minutes</p>
          <p>Once you tap seats, we hold them while you check out. No race, no rush.</p>
        </li>
        <li className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Pay to confirm</p>
          <p>Until you pay, the seat is yours without charge. The card runs only on confirm.</p>
        </li>
      </ul>
    </section>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-danger">Showtimes unavailable</p>
      <h1 className="font-display text-3xl text-ink mt-3 mb-3 font-bold">
        We can&apos;t reach this film&apos;s schedule
      </h1>
      <p className="text-muted mb-6">{message}</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent/30 hover:bg-accent-soft transition-colors duration-200 cursor-pointer shadow-sm"
      >
        Back to films
      </Link>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">Film not found</p>
      <h1 className="font-display text-3xl text-ink mt-3 mb-3 font-bold">That film isn&apos;t on this week</h1>
      <p className="text-muted mb-6">
        It may have finished its run or the link is wrong. Browse current films to find something to
        watch.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:border-accent/30 hover:bg-accent-soft transition-colors duration-200 cursor-pointer shadow-sm"
      >
        Browse films
      </Link>
    </div>
  );
}

/* -- Helpers --------------------------------------------------------------- */

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
