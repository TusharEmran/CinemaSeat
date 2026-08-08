/**
 * Circuit breaker + bounded retry with jitter for outbound gateway calls.
 *
 *   CLOSED    -> OPEN after N consecutive failures
 *   OPEN      -> fail fast (503) for a cooldown, no socket spent
 *   HALF_OPEN -> one probe decides whether to close again
 *
 * With the gateway container stopped, this is what keeps hold requests fast.
 * Without it, every payment attempt sits on a timeout and eats the connection
 * pool that browsing and holding also need — one dead dependency taking the
 * whole system with it, which is exactly what the brief says must not happen.
 */
export {};
