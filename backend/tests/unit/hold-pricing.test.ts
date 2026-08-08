/**
 * Pricing is money, so it gets its own tests: tier overrides, multi-seat totals,
 * and the rule that everything is integer minor units — never a float.
 */

import { describe, it, expect } from 'vitest';

describe('hold pricing', () => {
  it('prices each seat by its tier for the showtime', () => {
    expect.fail('TODO: implement');
  });

  it('falls back to the showtime base price when a tier has no override', () => {
    expect.fail('TODO: implement');
  });

  it('sums a multi-seat hold in minor units with no floating point drift', () => {
    expect.fail('TODO: implement');
  });
});
