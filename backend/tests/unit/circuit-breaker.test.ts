/**
 * The breaker is what keeps a dead gateway from eating the connection pool that
 * browsing and holding also need, so it is worth testing on its own.
 */

import { describe, it, expect } from 'vitest';

describe('circuit breaker', () => {
  it('stays closed while calls succeed', () => {
    expect.fail('TODO: implement');
  });

  it('opens after N consecutive failures', () => {
    expect.fail('TODO: implement');
  });

  it('fails fast while open instead of spending a socket', () => {
    expect.fail('TODO: implement');
  });

  it('half-opens after the cooldown and closes on a successful probe', () => {
    expect.fail('TODO: implement');
  });

  it('retries with jitter and gives up after GATEWAY_MAX_RETRIES', () => {
    expect.fail('TODO: implement');
  });
});
