/**
 * GET /api/movies
 * GET /api/movies/:movieId/showtimes
 * GET /api/theatres
 *
 * Read-only, cacheable, and completely independent of the gateway. These must
 * keep working when the gateway is stopped (fault-isolation bonus) and when the
 * premiere showtime is being hammered (graceful-degradation bonus).
 */
export {};
