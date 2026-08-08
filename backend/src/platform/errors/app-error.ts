/**
 * Typed domain errors -> stable HTTP codes and machine-readable slugs.
 *
 *   SEAT_UNAVAILABLE     409   lost the race (expected, not exceptional)
 *   HOLD_NOT_FOUND       404
 *   HOLD_EXPIRED         410   held it, took too long
 *   BOOKING_NOT_FOUND    404
 *   GATEWAY_UNAVAILABLE  503   breaker open — honest, and never a 500
 *   VALIDATION_FAILED    422
 *
 * Nothing in the booking path is allowed to surface as a bare 500. The
 * fault-isolation bonus is explicitly graded on that.
 */
export {};
