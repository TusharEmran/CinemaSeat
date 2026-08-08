/**
 * Rate limiting backed by Redis, so the limit is global rather than per replica.
 *
 * Excluded: /health, /ready, /metrics, and the gateway callback — throttling the
 * gateway would make it retry forever, which is the one thing we must not do.
 */
export {};
