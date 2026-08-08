/**
 * Builds the live seat map.
 *
 * A claim row with expires_at < now() reads as AVAILABLE even if the sweeper
 * has not flipped it yet - the map must never show a seat as taken when the
 * next hold request would succeed on it.
 *
 * Returns server_time so the client can render the countdown without trusting
 * its own clock.
 */
export {};
// TODO: build(showtimeId) -> { rows: [{ row, seats: [{ status, ... }] }] }
