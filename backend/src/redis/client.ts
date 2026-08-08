/**
 * ioredis client.
 *
 * Redis is a CACHE and a rate-limit store. It is NEVER consulted to decide
 * whether a seat is free - that decision belongs to the Postgres unique index
 * alone. If Redis is down the seat map gets slower, not wrong.
 *
 * So: lazyConnect, short timeouts, and every call site must tolerate failure.
 */
export {};
// TODO: export const redis, export async function closeRedis()
