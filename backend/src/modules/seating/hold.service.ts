/**
 * Seat holding. The heart of the system.
 *
 * claim(showtimeId, seatLabels, userRef):
 *   1. resolve labels -> seat ids, price each from showtime_prices
 *   2. SORT seat ids  <- deterministic order makes deadlock between two
 *                        overlapping multi-seat requests impossible
 *   3. in ONE transaction, for each seat:
 *        INSERT INTO seat_claims (...) VALUES (..., 'HELD', now() + ttl)
 *        ON CONFLICT DO NOTHING RETURNING *
 *      zero rows -> roll back the whole transaction, return SEAT_UNAVAILABLE
 *      (all-or-nothing: never hand back a partial row of seats)
 *   4. invalidate the seat-map cache
 *
 * TTL comes from env.HOLD_TTL_SECONDS. Never hardcode it.
 *
 * There is deliberately no SELECT-then-INSERT anywhere in this file. A read
 * before the write reopens the race the unique index exists to close.
 */
export {};
// TODO: claim(), release(), releaseExpired(), findByHoldId()
