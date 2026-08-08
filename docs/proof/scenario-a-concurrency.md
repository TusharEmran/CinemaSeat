# Scenario A — One seat, many buyers

**Required.** Oversell must be zero. Exactly one request may succeed.

> Claims are worth nothing. Numbers are worth marks. Fill every `TODO` with a real observation,
> not a hope.

---

## Method

- **Target:** seat `F12`, showtime `11111111-1111-1111-1111-111111111111` (Spider-Man: Brand New Day, midnight premiere)
- **Requests:** 100 concurrent `POST /api/holds` for that exact seat, fired as a single burst
- **Generator:** k6, [`load/scenario-a-one-seat.js`](../../load/scenario-a-one-seat.js), `per-vu-iterations` so all 100 VUs fire once, simultaneously
- **Run from:** `TODO — host machine / laptop`. **Not** on the machine running the stack.
- **Target environment:** `TODO — local compose | deployed URL`, `TODO — instance type, vCPU, RAM`
- **API replicas:** `TODO` — worth stating, because the invariant must hold across replicas, not just within one process

```bash
k6 run -e BASE_URL=<url> -e SEAT_LABEL=F12 load/scenario-a-one-seat.js
```

---

## Results

| Metric | Value | Expected |
| --- | --- | --- |
| Requests sent | `TODO` | 100 |
| Successful holds (`201`) | `TODO` | **1** |
| Clean rejections (`409`) | `TODO` | **99** |
| Server errors (`5xx`) | `TODO` | **0** |
| Other statuses | `TODO` | 0 |
| **Oversell count** | `TODO` | **0** |

### Latency

| | Value |
| --- | --- |
| p50 | `TODO` |
| p95 | `TODO` |
| p99 | `TODO` |
| max | `TODO` |

Losing the race should cost about the same as winning it — a `409` is a decision, not a retry.
If rejection latency is materially worse than success latency, say so and explain why.

### Seat map afterwards

```bash
curl -s <url>/api/showtimes/11111111-1111-1111-1111-111111111111/seatmap | jq '…F12'
```

```jsonc
TODO — paste the actual F12 entry. It must appear once, with status HELD.
```

Direct check against the database:

```sql
SELECT count(*) FROM seat_claims
 WHERE showtime_id = '1111…' AND seat_id = '<F12>' AND state IN ('HELD','BOOKED');
-- TODO: paste result. Must be 1.
```

---

## Why exactly one won

`TODO — in your own words.` The mechanism: a partial unique index on
`(showtime_id, seat_id) WHERE state IN ('HELD','BOOKED')` makes the hold a single
`INSERT … ON CONFLICT DO NOTHING`. There is no read-then-write window, so the database — not the
application, and not a lock — picks the winner. Zero rows returned becomes a `409`.

State what you would have expected from a `SELECT` -then-`INSERT` implementation instead, and
why the burst would have found that window.

## What surprised us

`TODO — optional, and disproportionately convincing.`
