/**
 * The one-shot `migrate` compose service runs this.
 *
 *   migrate -> exits 0 -> api and worker are allowed to start
 *
 * This is what makes "docker compose up from a clean clone, no manual steps"
 * true. Runs migrations, then seeds if SEED_ON_BOOT and the DB is empty.
 * Idempotent: safe to run on every boot.
 */
export {};
// TODO: await runMigrations(); if (env.SEED_ON_BOOT) await seed(); process.exit(0)
