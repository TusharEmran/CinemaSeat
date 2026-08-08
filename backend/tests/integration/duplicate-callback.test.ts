/**
 * The 8% duplicate callback.
 *
 * Delivering the same event_id twice must not:
 *   - create a second payment
 *   - confirm the booking twice
 *   - double-count revenue
 *
 * And both deliveries must answer 200. A non-200 tells the gateway that
 * delivery failed and it retries forever.
 */

import { describe, it, expect } from 'vitest';

describe('duplicate payment callback', () => {
  it('returns 200 for both deliveries of the same event_id', async () => {
    // const body = { event_id: 'evt_001', payment_id: 'pay_xyz',
    //                booking_ref: ref, status: 'SUCCEEDED', amount: 450 };
    // const first  = await postCallback(body);
    // const second = await postCallback(body);      // byte-identical replay
    // expect(first.statusCode).toBe(200);
    // expect(second.statusCode).toBe(200);
    expect.fail('TODO: implement');
  });

  it('records the second delivery as DUPLICATE and leaves the booking untouched', async () => {
    // expect(await countPayments(bookingId)).toBe(1);
    // expect(await countCallbackEvents('evt_001')).toBe(1);
    // const booking = await getBooking(ref);
    // expect(booking.status).toBe('CONFIRMED');
    // expect(booking.confirmedAt).toEqual(confirmedAtAfterFirstCallback);  // not moved
    expect.fail('TODO: implement');
  });

  it('counts revenue exactly once', async () => {
    // expect(await sumConfirmedRevenue()).toBe(450_00);
    expect.fail('TODO: implement');
  });

  it('survives two duplicate callbacks arriving concurrently', async () => {
    // The nastier version: both deliveries race into the unique index at the
    // same moment. Promise.all, not sequential.
    expect.fail('TODO: implement');
  });

  it('returns 200 and records REJECTED for an unknown booking_ref', async () => {
    // Nothing is silently dropped, and the gateway is never told to retry.
    expect.fail('TODO: implement');
  });

  it('returns 200 and records REJECTED for a malformed body', async () => {
    expect.fail('TODO: implement');
  });
});
