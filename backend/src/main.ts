/**
 * API entrypoint.
 *
 * Responsibilities, and nothing else:
 *   1. build the Fastify app (see app.ts - tests import that, not this)
 *   2. listen on env.PORT
 *   3. handle SIGTERM/SIGINT: stop accepting, drain in-flight, close pools
 *
 * Graceful shutdown matters for the "stay reachable during deployment" mark:
 * a rolling restart must not kill a request that is mid-hold.
 */
export {};
// TODO: buildApp() -> listen -> process.on('SIGTERM', drain)
