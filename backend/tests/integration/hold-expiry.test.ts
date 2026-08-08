/**
 * Scenario B, as an automated test.
 *
 * Hold a seat, walk away, let the hold expire, and prove a DIFFERENT user can
 * then book it.
 *
 * Runs with HOLD_TTL_SECONDS set to a couple of seconds so the suite stays
 * fast. That the TTL is injectable at all is the point — it is read from the
 * environment, never hardcoded.
 */

import { describe, it, expect } from 'vitest';

describe('abandoned hold', () => {
  it('reports the seat as HELD with an expires_at while the hold is live', async () => {
    expect.fail('TODO: implement');
  });

  it('rejects a second user with 409 before the hold expires', async () => {
    expect.fail('TODO: implement');
  });

  it('returns the seat to AVAILABLE once the TTL passes', async () => {
    // Two things worth asserting separately:
    //   1. the seat map reads AVAILABLE even before the sweeper runs
    //      (readers treat expires_at < now() as free — correctness does not
    //      depend on the worker being alive)
    //   2. the sweeper eventually flips the row to EXPIRED
    expect.fail('TODO: implement');
  });

  it('lets a different user hold and book the seat afterwards', async () => {
    // The actual Scenario B evidence: user B ends up CONFIRMED on the seat
    // user A abandoned.
    expect.fail('TODO: implement');
  });

  it('does not resurrect the first hold if its payment callback arrives late', async () => {
    // The ugly one. A succeeds payment 3s after their hold expired and B has
    // already booked the seat. A must NOT be confirmed onto B's seat — the
    // booking goes EXPIRED and the payment is refunded.
    expect.fail('TODO: implement');
  });
});
