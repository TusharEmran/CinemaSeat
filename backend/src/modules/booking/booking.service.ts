/**
 * Booking lifecycle.
 *
 * create(holdId, phone):
 *   - hold must exist, be HELD, and not be expired
 *   - one booking per hold (unique index on bookings.hold_id)
 *
 * confirm(bookingRef, payment):  called ONLY from the callback path
 *   - flip seat_claims HELD -> BOOKED, clear expires_at
 *   - booking -> CONFIRMED, issue ticket QR
 *   - MUST be idempotent: a duplicate callback that reaches here finds the
 *     booking already CONFIRMED and returns the existing ticket unchanged
 *
 * fail(bookingRef, reason):
 *   - release the hold immediately so the seat goes back on the map
 */
export {};
