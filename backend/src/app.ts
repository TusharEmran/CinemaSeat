/**
 * Builds the Fastify instance. Pure - no listen(), no process.exit().
 *
 * Tests import buildApp() and drive it with app.inject(), so the whole HTTP
 * surface is testable without binding a port.
 *
 * Registration order is deliberate:
 *   logging (request id first, so everything after it can log with one)
 *   -> security (helmet, cors) -> rate limit -> metrics
 *   -> health (before anything that can be slow)
 *   -> module routes
 *   -> error handler (last, catches everything above)
 */
export {};
// TODO: export async function buildApp(overrides?): Promise<FastifyInstance>
