/**
 * Seat-map read cache. Short TTL (~1s) plus explicit invalidation on every
 * claim/release for the affected showtime.
 *
 * This is the graceful-degradation lever: under a premiere hammering, browse
 * and seat-map reads for OTHER showtimes are served from here and never touch
 * the contended rows.
 *
 * On any Redis error: log once, fall through to Postgres, do not throw.
 */
export {};
// TODO: get(showtimeId), set(showtimeId, payload), invalidate(showtimeId)
