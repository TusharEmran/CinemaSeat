/**
 * Callback processing. Idempotency lives here.
 *
 *   1. INSERT INTO callback_events (event_id, ...) ON CONFLICT (event_id) DO NOTHING
 *      -> zero rows means we have seen this event before:
 *         record outcome DUPLICATE, return 200, TOUCH NOTHING ELSE.
 *         No second payment. No second confirmation. Revenue counted once.
 *   2. resolve the payment by booking_ref (it always exists — we write the
 *      payment row BEFORE calling /charge, which is what makes
 *      `X-Mock-Force: race` survivable)
 *   3. apply via the booking state machine:
 *        SUCCEEDED -> confirm
 *        FAILED    -> fail + release the hold so the seat goes back on the map
 *        REFUNDED  -> refund
 *   4. unknown booking_ref or illegal transition -> outcome REJECTED with a
 *      reason, still 200. Nothing is ever silently dropped.
 *
 * Steps 1–3 run in ONE transaction, so a crash mid-way cannot leave an event
 * marked processed with the booking untouched.
 */
export {};
