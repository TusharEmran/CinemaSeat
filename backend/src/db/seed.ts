/**
 * Pre-populates movies, theatres, screens, seat layouts, showtimes and prices.
 * No admin portal is required by the brief, so this file IS the admin portal.
 *
 * Must include a hammer target with FIXED, KNOWN IDs so Scenario A and the
 * README curl examples are copy-pasteable and stable across rebuilds:
 *
 *   movie      Spider-Man: Brand New Day
 *   showtime   11111111-1111-1111-1111-111111111111  (midnight premiere)
 *   seat       F12                                    (the contested seat)
 *
 * Idempotent - ON CONFLICT DO NOTHING on fixed ids, so re-running is a no-op.
 */
export {};
// TODO: export async function seed(): Promise<void>
