/**
 * Settles payments whose callback never arrived (the gateway 500s or times out
 * on 2% of charges, and callbacks run up to 15s late even when they work).
 *
 * For each PENDING payment older than env.PAYMENT_RECONCILE_AFTER_SECONDS:
 *   - gateway reachable   -> ask, then apply through the same callback service,
 *     so reconciliation and real callbacks share one idempotent code path
 *   - gateway unreachable -> leave PENDING, retry next tick. This is the
 *     "pending payments recover when the gateway comes back" bonus.
 *   - hold already expired and still unpaid -> booking EXPIRED, release the
 *     seats, and refund if the money did in fact land
 *
 * Never invents an outcome. Unknown stays PENDING.
 */
export {};
