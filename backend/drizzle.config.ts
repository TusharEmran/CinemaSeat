import { defineConfig } from 'drizzle-kit';

/**
 * Generation only. The migrations that actually run are the SQL files in
 * src/db/migrations/, applied by src/db/migrate.ts — because the load-bearing
 * object (a partial unique index) is not expressible in the Drizzle DSL, and we
 * want it readable in plain SQL rather than hidden behind a generator.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cinema:cinema@localhost:5432/cinemaseat',
  },
  verbose: true,
  strict: true,
});
