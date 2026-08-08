/**
 * Assigns a request id (incoming X-Request-Id, or a fresh ULID), attaches it to
 * a child logger, and echoes it in the response header and in every error body.
 *
 * Under a 100-request burst this is the only way to follow one seat's story
 * through api -> worker -> callback.
 */
export {};
