/**
 * MOCK DATA
 *
 * DELETE OR FLIP `NEXT_PUBLIC_USE_MOCKS=false`
 * WHEN THE BACKEND IS WIRED UP.
 *
 * The home / showtimes / seat-map pages fall back to these fixtures when:
 *
 * - NEXT_PUBLIC_USE_MOCKS === "true" (default for demo), OR
 * - the live API call fails / returns empty.
 *
 * Posters use TMDB's public image CDN.
 *
 * IDs are stable UUID-shaped strings so links remain consistent.
 *
 * The fixture seat map matches the README scenario:
 * - F12 is HELD by somebody else
 * - E5/E6 are BOOKED
 * - G1 is HELD
 * - This allows the frontend to demonstrate the 409 conflict path.
 */

import type {
  Movie,
  Seat,
  SeatMap,
  SeatRow,
  Showtime,
} from './types';

/* -------------------------------------------------------------------------- */
/* TMDB                                                                         */
/* -------------------------------------------------------------------------- */

const TMDB_IMG = 'https://image.tmdb.org/t/p/w780';

/* -------------------------------------------------------------------------- */
/* Movie seed data                                                              */
/* -------------------------------------------------------------------------- */

interface MockSeed {
  id: string;
  title: string;
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  poster_path: string;
  featured?: boolean;
}

const SEEDS: MockSeed[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Interstellar',
    rating: 'PG-13',
    runtime_minutes: 169,
    synopsis:
      'A team of explorers travels through a wormhole in space in an attempt to ensure humanity’s survival.',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    featured: true,
  },

  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'The Dark Knight',
    rating: 'PG-13',
    runtime_minutes: 152,
    synopsis:
      'Batman faces a criminal mastermind whose chaotic plans push Gotham City into a dangerous new era.',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  },

  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Oppenheimer',
    rating: 'R',
    runtime_minutes: 181,
    synopsis:
      'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  },

  {
    id: '44444444-4444-4444-4444-444444444444',
    title: 'The Green Mile',
    rating: 'R',
    runtime_minutes: 189,
    synopsis:
      'A prison guard encounters a mysterious inmate whose extraordinary abilities change the lives around him.',
    poster_path: '/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg',
  },

  {
    id: '55555555-5555-5555-5555-555555555555',
    title: 'Dune',
    rating: 'PG-13',
    runtime_minutes: 155,
    synopsis:
      'A young heir travels to a dangerous desert world where his family becomes caught in a struggle for control.',
    poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
  },

  {
    id: '66666666-6666-6666-6666-666666666666',
    title: 'The Revenant',
    rating: 'R',
    runtime_minutes: 156,
    synopsis:
      'A frontiersman fights to survive and seeks justice after being left behind during an expedition.',
    poster_path: '/oXUWEc5i3wYyFnL1Ycu8ppxxPvs.jpg',
  },

  {
    id: '77777777-7777-7777-7777-777777777777',
    title: 'Big Hero 6',
    rating: 'PG',
    runtime_minutes: 102,
    synopsis:
      'A robotics prodigy and his friends form a high-tech team to protect their city.',
    poster_path: '/3zQvuSAUdC3mrx9vnSEpkFX0968.jpg',
  },

  {
    id: '88888888-8888-8888-8888-888888888888',
    title: 'The Conclave',
    rating: 'PG-13',
    runtime_minutes: 120,
    synopsis:
      'A group of powerful figures gather in secret as they face an unexpected crisis and a dangerous conspiracy.',
    poster_path: '/m5x8D0bZ3eKqIVWZ5y7TnZ2oTVg.jpg',
  },
];

/* -------------------------------------------------------------------------- */
/* Movies                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Return all mock movies.
 */
export function getMockMovies(): Movie[] {
  return SEEDS.map((movie) => ({
    id: movie.id,
    title: movie.title,
    rating: movie.rating,
    runtime_minutes: movie.runtime_minutes,
    poster_url: `${TMDB_IMG}${movie.poster_path}`,
  }));
}

/**
 * Return the featured movie.
 *
 * If no movie is marked as featured,
 * the first movie is used.
 */
export function getMockHero(): Movie {
  const featured = SEEDS.find((movie) => movie.featured) ?? SEEDS[0];

  return {
    id: featured.id,
    title: featured.title,
    rating: featured.rating,
    runtime_minutes: featured.runtime_minutes,
    poster_url: `${TMDB_IMG}${featured.poster_path}`,
  };
}

/**
 * Get synopsis text for a movie by ID.
 *
 * Used by the hero section.
 */
export function getMockSynopsis(
  movieId: string,
): string | undefined {
  return SEEDS.find(
    (movie) => movie.id === movieId,
  )?.synopsis;
}

/* -------------------------------------------------------------------------- */
/* Showtimes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mock showtimes.
 *
 * Each movie gets:
 *
 * - Screen 1 at +2 hours
 * - Screen 1 at +5 hours
 * - IMAX premiere at +24 hours
 *
 * Prices are stored in minor units.
 *
 * Example:
 *
 * 45000 = ৳450.00
 * 75000 = ৳750.00
 *
 * The midnight/premiere slot is used for the
 * F12 concurrency conflict demonstration.
 */
export function getMockShowtimes(
  movieId: string,
): Showtime[] {
  const movie = SEEDS.find(
    (item) => item.id === movieId,
  );

  if (!movie) {
    return [];
  }

  /*
   * Anchor times to today so mock showtimes remain
   * useful even if the project sits unused for weeks.
   */
  const base = startOfToday();

  const slots: {
    offsetHours: number;
    theatre: string;
    screen: string;
    basePriceMinor: number;
  }[] = [
    {
      offsetHours: 2,
      theatre: 'Star Cineplex',
      screen: 'Screen 1',
      basePriceMinor: 45000,
    },

    {
      offsetHours: 5,
      theatre: 'Star Cineplex',
      screen: 'Screen 1',
      basePriceMinor: 45000,
    },

    /*
     * Premiere rush scenario.
     *
     * This showtime is intentionally the target for F12.
     */
    {
      offsetHours: 24,
      theatre: 'Star Cineplex',
      screen: 'IMAX',
      basePriceMinor: 75000,
    },
  ];

  return slots.map((slot, index) => ({
    id: `st-${movieId.slice(0, 8)}-${index}`,

    movie_id: movieId,

    theatre: {
      name: slot.theatre,
      screen: slot.screen,
    },

    starts_at: new Date(
      base.getTime() +
        slot.offsetHours * 3_600_000,
    ).toISOString(),

    base_price_minor: slot.basePriceMinor,
  }));
}


export function getMockSeatMap(
  showtimeId: string,
  movieId: string,
): SeatMap {
  const movie = SEEDS.find(
    (item) => item.id === movieId,
  );

  const showtime = getMockShowtimes(movieId).find(
    (item) => item.id === showtimeId,
  );

  

  const rows: SeatRow[] = [];

  const rowLabels = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
  ];

  /* ------------------------------------------------------------------------ */
  /* Occupied seats                                                             */
  /* ------------------------------------------------------------------------ */

  const occupied: Record<
    string,
    'HELD' | 'BOOKED'
  > = {
    /*
     * README concurrency scenario.
     *
     * Another user already has this seat.
     */
    F12: 'HELD',

    /*
     * Example booked seats.
     */
    E5: 'BOOKED',
    E6: 'BOOKED',

    /*
     * Another temporary hold.
     */
    G1: 'HELD',
  };

  const tierDelta: Record<
    Seat['tier'],
    number
  > = {

    STANDARD: 0,
    PREMIUM: 15000,
    RECLINER: 35000,
  };

  for (const row of rowLabels) {
    const seats: Seat[] = [];

    for (let number = 1; number <= 14; number++) {
      const label = `${row}${number}`;
      const tier: Seat['tier'] =
        row === 'A' || row === 'B'
          ? 'PREMIUM'
          : row === 'G' || row === 'H'
            ? 'RECLINER'
            : 'STANDARD';
      const status: Seat['status'] =
        occupied[label] ?? 'AVAILABLE';
      const priceMinor =
        (showtime?.base_price_minor ?? 45000) +
        tierDelta[tier];
      const seat: Seat = {
        seat_id: `seat-${showtimeId.slice(
          0,
          8,
        )}-${label}`,

        label,

        status,

        tier,

        price_minor: priceMinor,

        ...(status === 'HELD'
          ? {
              /*
               * Hold expires in 4 minutes.
               */
              held_until: new Date(
                Date.now() + 4 * 60_000,
              ).toISOString(),
            }
          : {}),
      };

      seats.push(seat);
    }

    rows.push({
      row,
      seats,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Return seat map                                                           */
  /* ------------------------------------------------------------------------ */

  return {
    showtime_id: showtimeId,

    movie: {
      title: movie?.title ?? 'Untitled',
      rating: movie?.rating ?? 'PG',
    },

    theatre:
      showtime?.theatre ?? {
        name: 'Star Cineplex',
        screen: 'Screen 1',
      },

    starts_at:
      showtime?.starts_at ??
      new Date().toISOString(),

    /*
     * Important for concurrency.
     *
     * In a real backend this should come from the
     * database/server rather than the browser.
     */
    server_time: new Date().toISOString(),

    rows,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns today's date at 00:00:00 local time.
 */
function startOfToday(): Date {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}