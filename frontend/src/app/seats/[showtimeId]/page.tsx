import Link from '../../../components/AppLink';

export const dynamic = 'force-dynamic';

import { ApiRequestError, getSeatMap, getShowtimes } from '../../../api/client';
import { getMockSeatMap, getMockShowtimes } from '../../../api/mock';
import type { SeatMap, Showtime } from '../../../api/types';

import { SeatPicker } from '../../../components/SeatPicker';

/*
 * Live seat map for one showtime -- white theme edition.
 * Select seats, hold them, go to checkout.
 * Prefers live API when backend is running, with seamless fallback for demo/offline.
 */
interface PageProps {
  params: Promise<{ showtimeId: string }>;
}

export default async function SeatMapPage({ params }: PageProps) {
  const { showtimeId } = await params;

  let seatMap: SeatMap | null = null;
  let showtime: Showtime | null = null;
  let source: 'live' | 'mock' | 'none' = 'none';
  let loadError: string | null = null;

  const forceMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

  if (!forceMocks) {
    try {
      seatMap = await getSeatMap(showtimeId);
      try {
        const candidates = await getShowtimes('').catch(() => []);
        showtime = candidates.find((s) => s.id === showtimeId) ?? null;
      } catch {
        showtime = null;
      }
      source = 'live';
    } catch (err) {
      loadError = err instanceof ApiRequestError ? err.message : 'Could not load the seat map.';
    }
  }

  if (!seatMap && (forceMocks || loadError)) {
    seatMap = getMockSeatMap(showtimeId, inferMovieId(showtimeId));
    showtime = getMockShowtimes(inferMovieId(showtimeId)).find((s) => s.id === showtimeId) ?? null;
    source = seatMap ? 'mock' : 'none';
    loadError = null;
  }

  if (loadError && !seatMap) {
    return <LoadError message={loadError} />;
  }

  if (!seatMap) {
    return <NotFound />;
  }

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
      <Breadcrumb movieTitle={seatMap.movie.title} showtime={showtime} />

      <header className="mt-6 mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Now showing</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1 font-bold">{seatMap.movie.title}</h1>
        <p className="text-sm text-muted mt-2">
          {seatMap.theatre.name} · {seatMap.theatre.screen} ·{' '}
          <time dateTime={seatMap.starts_at}>{formatShowtime(seatMap.starts_at)}</time>
        </p>
        {source === 'mock' && (
          <p className="text-xs text-muted mt-3">
            <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent mr-2 align-middle font-semibold">
              Demo
            </span>
            Showing demo seat map. Live backend will connect automatically when available.
          </p>
        )}
      </header>

      <SeatPicker initialSeatMap={seatMap} />

      <PricingNote />
    </div>
  );
}

/* -- Sub-blocks ------------------------------------------------------------ */

function Breadcrumb({
  movieTitle,
  showtime,
}: {
  movieTitle: string;
  showtime: Showtime | null;
}) {
  const back = showtime ? `/showtimes/${encodeURIComponent(showtime.movie_id)}` : '/';

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/" className="hover:text-accent transition-colors duration-200">
            Films
          </Link>
        </li>
        <li aria-hidden="true">&gt;</li>
        <li>
          <Link href={back} className="hover:text-accent transition-colors duration-200">
            {movieTitle}
          </Link>
        </li>
        <li aria-hidden="true">&gt;</li>
        <li className="text-ink font-medium" aria-current="page">
          Pick seats
        </li>
      </ol>
    </nav>
  );
}

function PricingNote() {
  return (
    <section
      aria-labelledby="pricing-note-title"
      className="mt-14 border-t border-line pt-8"
    >
      <h2 id="pricing-note-title" className="font-display text-xl text-ink mb-3 font-semibold">
        What you&apos;re paying for
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted leading-relaxed">
        <li className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Standard</p>
          <p>The middle of the house. Most rows, most seats, the price most people pay.</p>
        </li>
        <li className="rounded-2xl border border-accent/20 bg-accent-soft p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Premium</p>
          <p>The front two rows. Closer to the screen, better sight lines, a bit more.</p>
        </li>
        <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-ink font-semibold mb-1">Recliner</p>
          <p>The back two rows. Reclined seating, more legroom, the most expensive ticket.</p>
        </li>
      </ul>
    </section>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-danger">Seat map unavailable</p>
      <h1 className="font-display text-3xl text-ink mt-3 mb-3 font-bold">We can&apos;t load this screen</h1>
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
      <p className="text-xs uppercase tracking-[0.25em] text-muted">Showtime not found</p>
      <h1 className="font-display text-3xl text-ink mt-3 mb-3 font-bold">That screen isn&apos;t on sale</h1>
      <p className="text-muted mb-6">
        The showtime may have ended or been removed. Browse current films to pick another.
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

function inferMovieId(showtimeId: string): string {
  const m = showtimeId.match(/^st-([0-9a-f]{8})-\d+$/i);
  if (m) {
    return `${m[1].padEnd(8, '0')}-1111-1111-1111-111111111111`.slice(0, 36);
  }
  return '11111111-1111-1111-1111-111111111111';
}

function formatShowtime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
