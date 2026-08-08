/**
 * Worker entrypoint. Same image as the API, different command.
 *
 * Runs two loops:
 *   - hold-expiry sweep      (jobs/hold-expiry.job.ts)
 *   - payment reconciliation (jobs/payment-reconcile.job.ts)
 *
 * Why a separate container: a slow sweep or a stuck gateway call must never
 * add latency to a hold request. Different failure domain, different process.
 *
 * Correctness does NOT depend on this process running. Reads and claims treat
 * an expired row as available on their own; the sweeper only makes the seat map
 * go green without waiting for a reader to notice.
 */
export {};
// TODO: start both loops, share one SIGTERM handler, exit 0 on drain
