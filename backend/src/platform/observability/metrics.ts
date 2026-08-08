/**
 * GET /metrics — prom-client.
 *
 * The counters that tell the real story:
 *   holds_attempted_total / holds_won_total / holds_rejected_total{reason}
 *   oversell_total                        <- must be 0 forever; alert on any increment
 *   callbacks_received_total{outcome}      applied | duplicate | rejected
 *   gateway_requests_total{endpoint,outcome} + a breaker-state gauge
 *   hold_expiry_sweep_reclaimed_total
 *   http_request_duration_seconds          histogram — the p95 for Scenario C
 *
 * Scenario C is much easier to explain when you can point at which of these
 * turned upward first.
 */
export {};
