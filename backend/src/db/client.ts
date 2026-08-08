/**
 * Postgres connection pool (postgres.js) + Drizzle instance.
 *
 * Pool sizing is a Scenario C variable: too small and holds queue behind
 * browse traffic, too large and Postgres thrashes. Set via env.DB_POOL_MAX and
 * reported in docs/proof/scenario-c-breakpoint.md.
 */
export {};
// TODO: export const sql, export const db, export async function closeDb()
