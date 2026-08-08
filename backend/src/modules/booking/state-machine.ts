/**
 * Legal booking transitions. Pure function, no I/O - trivially unit-testable,
 * and the reason an out-of-order callback cannot corrupt a booking.
 *
 *   PENDING_PAYMENT -> CONFIRMED | PAYMENT_FAILED | EXPIRED | CANCELLED
 *   CONFIRMED       -> REFUNDED
 *   everything else -> terminal
 *
 * Two cases this exists to survive:
 *   - a late FAILED callback arriving after a SUCCEEDED one already confirmed
 *   - a REFUNDED callback for a booking that was never confirmed
 * Both must be rejected without throwing a 500 at the gateway.
 */
export {};
// TODO: export function canTransition(from, to): boolean
// TODO: export function assertTransition(from, to): void
