/**
 * Zod schemas for the callback body:
 *   { event_id, payment_id, booking_ref, status: SUCCEEDED|FAILED|REFUNDED, amount }
 *
 * Parse failures must NOT 4xx the gateway — record REJECTED, return 200.
 */
export {};
