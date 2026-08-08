/**
 * Scenario C — Find your breakpoint.  BONUS.
 *
 * Ramps virtual users against the seat map (read) and hold (write) endpoints
 * until the system degrades. What earns the marks is the EXPLANATION, not the
 * number: where p95 turns upward, where errors start, and what the bottleneck
 * actually was.
 *
 * Run from your host or laptop against the deployed URL. Never on the same
 * machine as the app.
 *
 *   k6 run -e BASE_URL=https://your-deployed-url load/scenario-c-ramp.js
 *
 * While it runs, watch the things that would tell you WHY:
 *   - /metrics: http_request_duration_seconds, gateway breaker state
 *   - pg_stat_activity: active vs idle-in-transaction, waiting on locks
 *   - docker stats: CPU saturation vs memory
 *   - event loop lag
 *
 * Candidate bottlenecks to rule in or out, in the order we would check them:
 *   1. connection pool exhaustion  (DB_POOL_MAX too low — queueing, not load)
 *   2. row-level contention on the hot seat (correct, but serialising)
 *   3. event loop blocked by JSON serialisation of a large seat map
 *   4. CPU saturation on a small VM
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const SHOWTIME_ID = __ENV.SHOWTIME_ID || '11111111-1111-1111-1111-111111111111';

const seatmapLatency = new Trend('seatmap_latency', true);
const holdLatency = new Trend('hold_latency', true);

export const options = {
  scenarios: {
    // Reads: the browse path. Should stay flat long after writes degrade —
    // if it does not, reads and writes are sharing something they should not.
    seatmap_reads: {
      executor: 'ramping-vus',
      exec: 'readSeatMap',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 300 },
        { duration: '30s', target: 500 },
        { duration: '20s', target: 0 },
      ],
    },
    // Writes: contended holds. Expect this to bend first.
    contended_holds: {
      executor: 'ramping-arrival-rate',
      exec: 'holdSeat',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    // Deliberately generous — this run is meant to find the wall, not pass.
    // Note WHERE these first break; that is the breakpoint you report.
    'seatmap_latency{p(95)}': ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export function readSeatMap() {
  group('seatmap', () => {
    const res = http.get(`${BASE_URL}/api/showtimes/${SHOWTIME_ID}/seatmap`, {
      tags: { name: 'GET /seatmap' },
    });
    seatmapLatency.add(res.timings.duration);
    check(res, { 'seatmap 200': (r) => r.status === 200 });
  });
}

export function holdSeat() {
  group('hold', () => {
    // Spread across a block of seats so we are measuring throughput rather than
    // re-running Scenario A. Scenario A is the correctness test; this is the
    // capacity test, and they answer different questions.
    const row = 'ABCDEFGHIJ'[Math.floor(Math.random() * 10)];
    const num = 1 + Math.floor(Math.random() * 20);

    const res = http.post(
      `${BASE_URL}/api/holds`,
      JSON.stringify({
        showtime_id: SHOWTIME_ID,
        seat_labels: [`${row}${num}`],
        user_ref: `load-${__VU}-${__ITER}`,
      }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /holds' } },
    );

    holdLatency.add(res.timings.duration);
    check(res, {
      // 409 means the seat was taken — a correct answer, not an error.
      'hold 201 or 409': (r) => r.status === 201 || r.status === 409,
      'no 5xx': (r) => r.status < 500,
    });
  });
}
