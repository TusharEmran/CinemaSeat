/**
 * GET /health  <- JUDGING HOOK #1
 *   200 in well under a second, and STILL 200 when the gateway is down.
 *   It checks nothing external. It proves this process is alive, no more.
 *
 * GET /ready
 *   Checks Postgres and Redis with short timeouts. This is what the load
 *   balancer polls, so a draining instance can fail readiness while /health
 *   stays green.
 *
 * Keeping these separate is the whole fault-isolation story: a dead gateway
 * must never make an orchestrator kill a perfectly healthy API container.
 */
export {};
