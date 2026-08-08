/**
 * Sweeps expired holds every env.SWEEP_INTERVAL_MS, in batches.
 *
 *   UPDATE seat_claims SET state = 'EXPIRED'
 *    WHERE state = 'HELD' AND expires_at < now()
 *    LIMIT env.SWEEP_BATCH_SIZE
 *
 * Safe to run in several worker replicas: the update is conditional on
 * state = 'HELD', so a row can only ever be reclaimed by one sweeper.
 *
 * This is the Scenario B mechanism. Correctness does not depend on it — readers
 * and claims already treat an expired row as available — but it is what makes
 * the seat map go green on its own, with no visitor required to trigger it.
 */
export {};
