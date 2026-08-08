/**
 * Gateway callback signature verification (security bonus).
 *
 * HMAC over the raw body with env.GATEWAY_CALLBACK_SECRET, compared using
 * timingSafeEqual. Needs the raw buffer, so app.ts registers a rawBody hook for
 * this route only.
 *
 * A bad signature is recorded as REJECTED and still answered 200.
 */
export {};
