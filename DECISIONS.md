# DECISIONS.md

Three decisions we genuinely argued about. For each: the options, what we chose, why, and
what we gave up.

> **Fill in the argument, not just the conclusion.** Judges can tell the difference between a
> decision that was made and a decision that was written up afterwards. Keep the dissenting
> view in the room — the "what we gave up" section is where the marks are.

---

## Decision 1 — Where the "one seat, one owner" invariant lives

### Options we considered

**A. Redis distributed lock (`SET NX PX`) per seat.**
Fast, and the obvious answer if you have seen this problem before. Hold the lock for the TTL,
release on payment or expiry.

**B. Postgres partial unique index + `INSERT … ON CONFLICT DO NOTHING`.**
The database refuses the second claim. One statement, no lock to acquire or release.

**C. Application-level queue — serialise all holds for a showtime through one consumer.**
Impossible to double-book if only one thing ever writes.

### What we chose

**B — the partial unique index.**

```sql
CREATE UNIQUE INDEX seat_claim_unique
    ON seat_claims (showtime_id, seat_id)
 WHERE state IN ('HELD', 'BOOKED');
```

### Why

The argument that ended it: **a Redis lock and a Postgres row can disagree.** If Redis evicts a
key under memory pressure, or a failover loses the last second of writes, or a hold's TTL fires
while the confirming transaction is still in flight, you get two clients each believing they own
F12 — and the database will happily write both, because nothing in the database says it must not.
Option A puts the invariant in the fast path but leaves the *durable* record unprotected.

With B the invariant is a property of the stored data, not of the code path that happened to run.
There is no window between check and write, so it holds under any number of API replicas without
coordination. It survives a full Redis outage, because Redis is not in the decision at all. And it
fails in the cheapest possible way: `ON CONFLICT DO NOTHING` returns zero rows, we return `409`,
no exception is thrown and no transaction is rolled back.

We rejected C quickly. A single consumer per showtime is trivially correct and trivially a
bottleneck — the premiere showtime is exactly the one that would queue, which inverts the goal.

### What we gave up

- **Every hold is a database write.** Under the burst, Postgres is the contended resource. Option A
  would have absorbed the spike in memory. We accepted a lower theoretical ceiling in exchange for
  an invariant we can prove — and Scenario C shows where that ceiling actually is.
- **Contention is row-level and hot.** 100 requests for F12 serialise on one row's index entry.
  Correct, but the tail latency on that single seat is worse than a Redis `SET NX` would be.
- **Postgres is now a hard dependency of the hold path.** If it is down, nobody holds anything.
  We judged that acceptable: if Postgres is down we cannot honour a booking anyway, so degrading
  to "read-only browsing" is more honest than accepting holds we cannot keep.

---

## Decision 2 — `TODO: the async payment / duplicate-callback design`

Suggested framing — replace with what you actually argued about:

### Options we considered
- **A.** Synchronous — `/pay` calls `/charge` and waits for the callback before responding.
- **B.** Async — `/pay` persists a `PENDING` payment, fires `/charge`, returns `202`; the callback finishes the job.
- **C.** Async + a reconciler that polls for payments whose callback never arrived.

### What we chose
`TODO`

### Why
`TODO — the callback is 2–15s late by specification and 8% arrive twice. Which of those two facts
drove the decision harder, and what did the losing option actually break on?`

### What we gave up
`TODO — e.g. the client must poll; "confirmed" is eventually consistent; there is a window where
the user has paid and the UI does not know yet. How do you show that to a user honestly?`

---

## Decision 3 — `TODO: modular monolith vs split services`

Suggested framing — replace with what you actually argued about:

### Options we considered
- **A.** One API image, modules with enforced boundaries, plus a separate worker image.
- **B.** Split `catalog` / `booking` / `payment` into independently deployed services behind nginx.

### What we chose
`TODO`

### Why
`TODO — the brief explicitly asks you to defend this either way. If you did not split, say what
splitting would have bought you and why it was not worth it in eight hours. If you did split, say
what it cost you — the inter-service call you had to debug, the transaction you could no longer
make atomic.`

### What we gave up
`TODO — be specific. "Less scalable" is not an answer; "catalog reads and hold writes share a
connection pool, so a browse spike can starve the hold path — we mitigated it with a separate pool
and measured it in Scenario C" is.`

---

## Things we were wrong about

`TODO — optional, and disproportionately convincing. Anything you built, measured, and then
changed your mind about.`
