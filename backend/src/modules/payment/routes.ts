/**
 * POST /api/webhooks/payments   the gateway callback
 *
 * THIS HANDLER ALWAYS RETURNS 200. Every path — duplicate, unknown
 * booking_ref, malformed body, bad signature, internal error — records what
 * happened in callback_events and answers 200. A non-200 tells the gateway
 * delivery failed and it retries forever.
 *
 * The handler itself does almost nothing: verify signature, insert the event
 * row, hand off. Keep it fast; the gateway is not waiting politely.
 */
export {};
