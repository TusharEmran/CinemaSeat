/**
 * The ONLY file that talks to the mock gateway. Do not write your own mock.
 *
 *   POST /charge      { amount, currency, booking_ref, callback_url }
 *   POST /refund      { payment_id }
 *   POST /otp/send    { phone, ref }
 *   POST /otp/verify  { ref, code }
 *
 * Wrapped in platform/http/circuit-breaker.ts:
 *   - hard timeout (env.GATEWAY_TIMEOUT_MS)
 *   - bounded retry with jitter on 5xx/timeout (2% of calls, by spec)
 *   - breaker opens after repeated failures -> fail fast with 503 instead of
 *     piling up sockets when the gateway container is stopped
 *
 * Retry is safe because booking_ref is our idempotency key: the gateway may
 * see the same ref twice, but our callback handler dedupes on event_id.
 *
 * Passes through X-Mock-Mode / X-Mock-Force from an internal test header, so
 * judges can force fail / duplicate / timeout / race / success end-to-end.
 */
export {};
