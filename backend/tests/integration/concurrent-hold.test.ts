/**
 * Scenario A, as an automated test.
 *
 * 100 concurrent hold requests for ONE seat on ONE showtime.
 * Exactly 1 must win. 99 must be cleanly rejected with 409. Oversell must be 0.
 *
 * The seats must actually fight. Spreading requests across many seats proves
 * nothing — it produces zero collisions and a green tick that means nothing.
 *
 * Fired with Promise.all against a real Postgres (testcontainers), because the
 * thing under test is a database index, and mocking the database would test
 * nothing at all.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('100 concurrent holds on one seat', () => {
  beforeAll(async () => {
    // TODO: start Postgres + Redis testcontainers, migrate, seed
    // TODO: buildApp()
  });

  afterAll(async () => {
    // TODO: close app, pools, containers
  });

  it('lets exactly one request win and rejects the other 99 with 409', async () => {
    // const CONCURRENCY = 100;
    //
    // const results = await Promise.all(
    //   Array.from({ length: CONCURRENCY }, (_, i) =>
    //     app.inject({
    //       method: 'POST',
    //       url: '/api/holds',
    //       payload: { showtime_id: SHOWTIME_ID, seat_labels: ['F12'], user_ref: `user-${i}` },
    //     }),
    //   ),
    // );
    //
    // const won      = results.filter((r) => r.statusCode === 201);
    // const rejected = results.filter((r) => r.statusCode === 409);
    // const other    = results.filter((r) => ![201, 409].includes(r.statusCode));
    //
    // expect(won).toHaveLength(1);
    // expect(rejected).toHaveLength(99);
    // expect(other).toHaveLength(0);   // no 500s — losing a race is not an error
    expect.fail('TODO: implement');
  });

  it('reports the seat as held exactly once in the seat map', async () => {
    // Guards the oversell case the status codes alone would miss: two winners
    // would still be two 201s unless we go and look at the map afterwards.
    //
    // const map = await app.inject({ url: `/api/showtimes/${SHOWTIME_ID}/seatmap` });
    // const f12 = findSeat(map.json(), 'F12');
    // expect(f12.status).toBe('HELD');
    //
    // const liveClaims = await countLiveClaims(SHOWTIME_ID, 'F12');
    // expect(liveClaims).toBe(1);   // ← the oversell count. Must be 1, never 2.
    expect.fail('TODO: implement');
  });

  it('holds all seats or none when one seat of a multi-seat request is taken', async () => {
    // A partial success would hand the user a broken row and silently strand a
    // seat. The claim transaction must roll back entirely.
    expect.fail('TODO: implement');
  });
});
