/**
 * Shared testcontainers setup: real Postgres + Redis for integration tests.
 *
 * Real Postgres, deliberately. The concurrency guarantee IS a Postgres partial
 * unique index — a fake would test our belief about the database rather than
 * the database.
 *
 * Started once per test file and reused, because container startup dominates
 * the runtime otherwise.
 */
export {};
// TODO: startPostgres(), startRedis(), migrateAndSeed(), stopAll()
// TODO: withTtl(seconds) — rebuild the app with a short HOLD_TTL_SECONDS
