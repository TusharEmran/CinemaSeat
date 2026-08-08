/**
 * initiate(bookingRef):
 *   1. write the payment row PENDING first, keyed by our own booking_ref
 *      (before /charge — this is the race defence, not an accident of ordering)
 *   2. call /charge with callback_url = env.PUBLIC_BASE_URL + /api/webhooks/payments
 *   3. store gateway_payment_id if the response arrives; if /charge 500s or
 *      times out, leave the row PENDING and let the reconciler settle it
 *   4. return immediately — never await the callback
 *
 * We never guess an outcome. A payment we are unsure about stays PENDING and is
 * resolved by evidence, not by a timeout defaulting to failure.
 */
export {};
