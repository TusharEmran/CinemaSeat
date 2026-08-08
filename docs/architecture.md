# Architecture

The long version. [`README.md`](../README.md) has the summary; this is what you defend in the room.

---

## The shape

A **modular monolith** — one API image with enforced internal boundaries — plus a **separate
worker image** running from the same code, behind **nginx**, over **Postgres** and **Redis**.

```
nginx ──▶ api ×N (stateless) ──▶ postgres  (source of truth)
                             └─▶ redis     (cache + rate limits, never truth)
worker ────────────────────────▶ postgres  (sweeper + reconciler)
gateway ──callback──▶ nginx ──▶ api
```

### Why not services

The brief says splitting is a choice, and asks you to defend either answer.

The entire correctness problem — claim a seat, turn the claim into a booking, attach a payment
to it — lives inside a single transactional boundary. Splitting `booking` from `seating` would
mean the seat claim and the booking row commit separately, which turns a one-line `INSERT …
ON CONFLICT` into a saga with compensating transactions. We would be inventing a distributed
commit protocol to solve a problem one Postgres statement already solves, and then debugging it
with four hours left.

What we split is what genuinely has a different failure profile: **the worker**. A hold sweep or
a stuck gateway call must never add latency to a hold request, so it runs in its own container
with its own connection pool. Different failure domain, different process. That is the boundary
that pays for itself.

**What we gave up:** we cannot scale the browse path independently of the booking path. Both
live in the same image and share a connection pool, so a browse spike can in principle starve
holds. The mitigation is the Redis seat-map cache plus a separate pool for read-only routes, and
we measure it in Scenario C rather than assuming it away.

---

## Concurrency: where the invariant lives

One partial unique index, described in [`../backend/src/db/migrations/0000_init.sql`](../backend/src/db/migrations/0000_init.sql):

```sql
CREATE UNIQUE INDEX seat_claim_unique
    ON seat_claims (showtime_id, seat_id)
 WHERE state IN ('HELD', 'BOOKED');
```

Properties that matter under a premiere burst:

- **No read-then-write window.** A hold is a single `INSERT … ON CONFLICT DO NOTHING RETURNING *`.
  There is no gap between checking and claiming for a competitor to slip into.
- **Replica count is irrelevant.** The invariant is a property of the stored data, so two API
  containers cannot disagree. No leader election, no distributed lock, no lease renewal.
- **Losing is cheap.** Zero rows returned. No exception thrown, no transaction rolled back, no
  retry. The caller gets a `409` in about the same time the winner gets a `201`.
- **Expiry needs no deletion.** `RELEASED` and `EXPIRED` fall outside the index predicate, so a
  dead hold stops blocking the seat while its history survives.
- **Multi-seat holds cannot deadlock.** Seats are claimed in sorted `seat_id` order inside one
  transaction, so two overlapping requests always grab the shared rows in the same sequence.

### Why Redis is not in this path

Redis caches seat-map reads and backs rate limits. It is never consulted to decide whether a
seat is free.

A Redis lock and a Postgres row can disagree — an evicted key, a failover that loses a second of
writes, a TTL firing while the confirming transaction is still in flight — and when they
disagree, the database happily writes both claims, because nothing in the database says it must
not. Putting the invariant in Redis makes the fast path fast and leaves the durable record
unprotected. If Redis is empty, cold, stale or entirely down, our worst outcome is a slightly
out-of-date seat map and a `409` on hold. Never an oversell.

---

## Hold lifecycle

```
   POST /api/holds
        │
        ▼
   INSERT seat_claims (state=HELD, expires_at = now() + HOLD_TTL_SECONDS)
   ON CONFLICT DO NOTHING
        │
   ┌────┴─────┐
   │          │
 1 row      0 rows
   │          └──▶ 409 SEAT_UNAVAILABLE   (99 of 100 requests land here)
   ▼
 201 hold ──▶ POST /api/bookings ──▶ POST /pay ──▶ 202 (returns immediately)
   │                                                    │
   │                                        gateway callback, 2–15s later
   │                                                    ▼
   │                                          SUCCEEDED ──▶ BOOKED, ticket issued
   │                                          FAILED    ──▶ hold released
   │
   └── nobody pays ──▶ expires_at passes
                         ├─ readers already treat it as AVAILABLE
                         └─ worker flips it to EXPIRED
```

Two independent reclaim mechanisms, on purpose. Readers treating an expired row as available is
what makes correctness independent of the worker being alive; the sweeper is what makes the seat
map go green without needing a visitor to trigger it. Either alone would work. Both together
mean a dead worker degrades freshness, not correctness.

---

## Failure isolation

| If this dies | What still works | What degrades |
| --- | --- | --- |
| Gateway | Browse, seat map, hold, `/health`, `/ready`. Breaker opens, payments fail fast with `503`. | Nobody can complete a purchase. Pending payments resume when it returns. |
| Redis | Everything. Seat maps read straight from Postgres. | Slower reads, rate limits fall back to per-instance. |
| Worker | Everything, including expiry — readers already treat expired rows as free. | Seat map shows a dead hold as `HELD` until someone reads it. |
| One API replica | Everything. Stateless, nginx routes around it. | Less headroom. |
| Postgres | `/health` only. | Everything. This is the one true dependency, and we say so rather than pretending otherwise. |

`/health` deliberately checks nothing external. If it probed the gateway, a dead payment
provider would make an orchestrator start killing perfectly healthy API containers — one
failing part taking everything down with it, which is the exact failure the brief asks us to
design against.

---

## Data model

Full definitions in [`../backend/src/db/schema.ts`](../backend/src/db/schema.ts).

```
movies ──< showtimes >── screens ──< seats
                │                      │
                └──────< seat_claims >─┘        ← the invariant lives here
                              │
                          bookings ──< payments
                                          │
                                   callback_events   ← event_id UNIQUE, absorbs the 8% duplicates
```

Three uniqueness rules carry the whole system:

| Index | Stops |
| --- | --- |
| `seat_claims (showtime_id, seat_id) WHERE state IN ('HELD','BOOKED')` | Double-booking |
| `callback_events (event_id)` | Duplicate callbacks double-confirming or double-counting revenue |
| `payments (booking_id)` | A double-clicked `/pay` opening two charges |

Money is stored in integer minor units everywhere. No floats touch a price.

---

## Scaling notes

- `api` is stateless and horizontally scalable — no sticky sessions, no in-process hold state.
- The contended resource under a premiere burst is one row's index entry in Postgres. That is
  the correct place for contention to land: it is the thing that must be serialised.
- Read scaling is the Redis seat-map cache plus a short TTL. It is also the graceful-degradation
  lever — people browsing other movies are served from cache and never touch the hot rows.
- Scenario C exists to find where this actually breaks, not to guess.

---

## What we would do with more time

`TODO — an honest list here is more convincing than an architecture with no stated limits.`
