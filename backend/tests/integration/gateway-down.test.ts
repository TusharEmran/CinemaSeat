/**
 * Fault isolation (bonus).
 *
 * With the gateway completely unreachable:
 *   - browsing, seat maps and holds still work
 *   - /health stays 200
 *   - nothing returns 500
 *   - pending payments recover when the gateway comes back
 */

import { describe, it, expect } from 'vitest';

describe('gateway stopped', () => {
  it('keeps /health green and fast', async () => {
    // /health must not probe the gateway. If it did, a dead payment provider
    // would make an orchestrator start killing healthy API containers.
    expect.fail('TODO: implement');
  });

  it('still serves the seat map and still accepts holds', async () => {
    expect.fail('TODO: implement');
  });

  it('fails payment attempts fast with 503, never 500 and never a hang', async () => {
    // Breaker open -> immediate, honest GATEWAY_UNAVAILABLE. The assertion
    // that matters is the latency one: it must not sit on the full timeout.
    expect.fail('TODO: implement');
  });

  it('recovers pending payments once the gateway returns', async () => {
    expect.fail('TODO: implement');
  });
});
