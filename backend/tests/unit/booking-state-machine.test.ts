/**
 * Pure, fast, no containers. This is the file that stops an out-of-order
 * callback from corrupting a booking.
 */

import { describe, it, expect } from 'vitest';

describe('booking state machine', () => {
  it.each([
    ['PENDING_PAYMENT', 'CONFIRMED'],
    ['PENDING_PAYMENT', 'PAYMENT_FAILED'],
    ['PENDING_PAYMENT', 'EXPIRED'],
    ['PENDING_PAYMENT', 'CANCELLED'],
    ['CONFIRMED', 'REFUNDED'],
  ])('allows %s -> %s', (_from, _to) => {
    expect.fail('TODO: implement');
  });

  it.each([
    // A late FAILED arriving after SUCCEEDED already confirmed the booking.
    ['CONFIRMED', 'PAYMENT_FAILED'],
    // A REFUNDED callback for a booking that was never confirmed.
    ['PENDING_PAYMENT', 'REFUNDED'],
    // Anything at all out of a terminal state.
    ['EXPIRED', 'CONFIRMED'],
    ['REFUNDED', 'CONFIRMED'],
  ])('rejects %s -> %s', (_from, _to) => {
    expect.fail('TODO: implement');
  });

  it('treats a repeat of the current state as a no-op, not an error', () => {
    // A duplicate callback reaching confirm() must be boring, not throw.
    expect.fail('TODO: implement');
  });
});
