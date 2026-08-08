# Scenario C — Find your breakpoint

**Bonus.** The explanation is what earns the marks. The number on its own tells nobody anything.

> Throughput is not compared between teams — different instance types, different resources.
> What is judged is methodology, the breakpoint, and the bottleneck explanation.
> Your VM size is not your engineering.

---

## Environment

| | |
| --- | --- |
| Target | `TODO — deployed URL / local compose` |
| Instance | `TODO — type, vCPU, RAM` |
| API replicas | `TODO` |
| `DB_POOL_MAX` | `TODO` |
| Postgres `max_connections` | `TODO` |
| Load generator | k6 on `TODO — laptop / host`, **not** the app machine |

Running k6 on the app machine measures your load tool fighting your own service. State plainly
where it ran.

---

## Method

[`load/scenario-c-ramp.js`](../../load/scenario-c-ramp.js) ramps two scenarios at once:

- **Reads** — `GET /seatmap`, ramping VUs 5 → 500
- **Writes** — `POST /holds`, ramping arrival rate 10 → 1000 req/s

Running both matters: the interesting question is not "when do holds break" but "do reads stay
healthy while writes are breaking". If they degrade together, reads and writes are sharing
something they should not be.

```bash
k6 run -e BASE_URL=<url> load/scenario-c-ramp.js
```

---

## Results

| Stage | Arrival rate | p50 | p95 | p99 | Error rate | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `TODO` | | | | | |
| 2 | `TODO` | | | | | |
| 3 | `TODO` | | | | | |
| 4 | `TODO` | | | | | |

**p95 turns upward at:** `TODO` req/s
**Errors begin at:** `TODO` req/s, first error type: `TODO`
**Reads stayed flat until:** `TODO`

---

## The bottleneck

**What it was:** `TODO`

**How we know:** `TODO — the measurement, not the guess.` Candidates and how to tell them apart:

| Candidate | What you would see |
| --- | --- |
| Connection pool exhaustion | Latency rises while Postgres CPU stays low; requests queue in the app. `DB_POOL_MAX` is the wall. Raising it moves the breakpoint. |
| Row-level contention | Confined to the contested seat; other seats stay fast. Correct behaviour — the thing that must serialise is serialising. |
| Blocked event loop | Event-loop lag climbs; CPU pinned in one process; *all* endpoints slow together including `/health`. |
| Postgres CPU / IO | Postgres saturates before the app does. `pg_stat_activity` full of `active`. |
| Memory | RSS climbs and never falls; GC pauses show in the p99 before the p95. |

**Evidence:** `TODO — paste the metric, the pg_stat_activity snapshot, the docker stats output,
the event-loop lag graph. One concrete artefact beats a paragraph of reasoning.`

**What we would change first, and what we would expect it to buy:** `TODO — and say how you would
verify the prediction. A prediction with a verification plan reads very differently from a
guess.`

---

## What we deliberately did not measure

`TODO — honest scoping. e.g. we did not test the payment path under load because the gateway
delay dominates and we would have been measuring the mock, not our system.`
