/**
 * Scenario A — One seat, many buyers.  REQUIRED.
 *
 * 100 concurrent hold requests for ONE seat on ONE showtime, in a single burst.
 * Exactly one may succeed. Ninety-nine must be cleanly rejected. Oversell = 0.
 *
 * The seats must fight. Spreading virtual users across many seats produces zero
 * collisions and proves nothing, so every VU here targets the same seat label.
 *
 * Run from your HOST, never from inside the stack — k6 and the API competing
 * for the same vCPUs measures your load generator, not your service.
 *
 *   k6 run -e BASE_URL=http://localhost:8080 -e SEAT_LABEL=F12 load/scenario-a-one-seat.js
 *
 * Paste the summary into docs/proof/scenario-a-concurrency.md.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const SHOWTIME_ID = __ENV.SHOWTIME_ID || '11111111-1111-1111-1111-111111111111';
const SEAT_LABEL = __ENV.SEAT_LABEL || 'F12';
const VUS = Number(__ENV.VUS || 100);

const held = new Counter('holds_succeeded');
const rejected = new Counter('holds_rejected_409');
const unexpected = new Counter('holds_unexpected_status');

export const options = {
  scenarios: {
    // All VUs fire once, at the same instant. Not a ramp — a burst.
    burst: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '30s',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    // The only number that actually matters.
    holds_succeeded: ['count==1'],
    holds_unexpected_status: ['count==0'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/holds`,
    JSON.stringify({
      showtime_id: SHOWTIME_ID,
      seat_labels: [SEAT_LABEL],
      user_ref: `vu-${exec.vu.idInTest}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /api/holds' } },
  );

  if (res.status === 201) held.add(1);
  else if (res.status === 409) rejected.add(1);
  else unexpected.add(1);

  check(res, {
    // A lost race is a 409, not a 500. Anything else is a real failure.
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'no server error': (r) => r.status < 500,
  });
}

/**
 * After the burst, go and look at the seat map. Status codes alone would miss a
 * genuine oversell: two winners are two 201s, and only the map shows the seat
 * claimed twice.
 */
export function teardown() {
  const res = http.get(`${BASE_URL}/api/showtimes/${SHOWTIME_ID}/seatmap`);
  const map = res.json();

  const matches = (map.rows || [])
    .flatMap((row) => row.seats || [])
    .filter((seat) => seat.label === SEAT_LABEL);

  const liveClaims = matches.filter((s) => s.status === 'HELD' || s.status === 'BOOKED').length;

  console.log('──────────── Scenario A ────────────');
  console.log(`requests sent   : ${VUS}`);
  console.log(`seat            : ${SEAT_LABEL} on showtime ${SHOWTIME_ID}`);
  console.log(`seat entries    : ${matches.length}  (expect 1)`);
  console.log(`live claims     : ${liveClaims}      (expect 1)`);
  console.log(`OVERSELL COUNT  : ${Math.max(0, liveClaims - 1)}  (must be 0)`);
  console.log('────────────────────────────────────');
}
