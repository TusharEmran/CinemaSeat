# CinemaSeat

A movie ticket booking system that stays calm when *Brand New Day* drops, and never sells the same seat twice.

> **Deployed URL:** `TODO — paste your Poridhi / AWS URL here before submission`

---

## Table of contents

- [Run it from a clean clone](#run-it-from-a-clean-clone)
- [The two requests judges will point tests at](#the-two-requests-judges-will-point-tests-at)
- [Architecture](#architecture)
- [How we never double-book](#how-we-never-double-book)
- [How we survive the gateway](#how-we-survive-the-gateway)
- [API reference](#api-reference)
- [Testing](#testing)
- [Proof (Milestone 4)](#proof-milestone-4)
- [CI/CD](#cicd)
- [What works, what does not](#what-works-what-does-not)

---

## Run it from a clean clone

```bash
git clone <repo-url>
cd CinemaSeat
docker compose up --build
```

That is the whole thing. No `.env` to copy, no migration to run by hand, no seed script to
remember — a one-shot `migrate` service runs migrations and seeds movies, theatres,
showtimes, seat layouts and prices before `api` and `worker` are allowed to start.

| What | Where |
| --- | --- |
| Frontend | <http://localhost:8080> |
| API (single base URL) | <http://localhost:8080/api> |
| Health | <http://localhost:8080/health> |
| Metrics | <http://localhost:8080/metrics> |
| Mock gateway | <http://localhost:9000> |

**To watch a hold expire**, run the stack with a short TTL:

```bash
HOLD_TTL_SECONDS=15 docker compose up --build
```

`HOLD_TTL_SECONDS` is read from the environment at startup ([`backend/src/config/env.ts`](backend/src/config/env.ts))
and is never hardcoded.

---

## The two requests judges will point tests at

### 1. Fetch the seat map

```bash
curl -s http://localhost:8080/api/showtimes/11111111-1111-1111-1111-111111111111/seatmap
```

```jsonc
{
  "showtime_id": "11111111-1111-1111-1111-111111111111",
  "movie": { "title": "Spider-Man: Brand New Day", "rating": "PG-13" },
  "theatre": { "name": "CUET Cineplex", "screen": "Screen 1" },
  "starts_at": "2026-08-09T00:00:00Z",
  "server_time": "2026-08-08T20:00:01Z",
  "rows": [
    {
      "row": "F",
      "seats": [
        { "seat_id": "…", "label": "F12", "status": "AVAILABLE", "price_minor": 45000, "tier": "PREMIUM" },
        { "seat_id": "…", "label": "F13", "status": "HELD",      "price_minor": 45000, "tier": "PREMIUM", "held_until": "2026-08-08T20:02:01Z" },
        { "seat_id": "…", "label": "F14", "status": "BOOKED",    "price_minor": 45000, "tier": "PREMIUM" }
      ]
    }
  ]
}
```

`status` is one of `AVAILABLE` · `HELD` · `BOOKED`. `server_time` is included so a client can
render the hold countdown without trusting its own clock.

### 2. Hold a seat

```bash
curl -s -X POST http://localhost:8080/api/holds \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 9f1c7f6e-1f0e-4a1b-9c2d-2b7a4e5f6a70' \
  -d '{
        "showtime_id": "11111111-1111-1111-1111-111111111111",
        "seat_labels": ["F12"],
        "user_ref": "zayan"
      }'
```

**Success — `201 Created`**

```jsonc
{
  "hold_id": "hold_01J…",
  "showtime_id": "11111111-1111-1111-1111-111111111111",
  "seats": [{ "seat_id": "…", "label": "F12", "price_minor": 45000 }],
  "total_minor": 45000,
  "currency": "BDT",
  "expires_at": "2026-08-08T20:02:01Z",
  "hold_ttl_seconds": 120
}
```

**Losing the race — `409 Conflict`** (this is what 99 of the 100 concurrent requests get)

```jsonc
{
  "error": "SEAT_UNAVAILABLE",
  "message": "Seat F12 is no longer available",
  "conflicting_seats": ["F12"],
  "request_id": "01J…"
}
```

A `409` is a clean rejection, not a failure. It is a deliberate, fast, and cheap answer —
no retry loop, no queue, no 500.

---

## Architecture

```
                        ┌──────────────┐
   browser ────────────▶│    nginx     │  one base URL, :8080
                        │ reverse proxy│  /  → web    /api → api
                        └───┬──────┬───┘
                            │      │
                   ┌────────▼──┐ ┌─▼────────┐
                   │  web      │ │   api    │ ×2 replicas, stateless
                   │ (static)  │ │ Fastify  │
                   └───────────┘ └─┬──┬──┬──┘
                                   │  │  │
              ┌────────────────────┘  │  └──────────────────┐
              │                       │                     │
      ┌───────▼──────┐        ┌───────▼──────┐      ┌───────▼────────┐
      │   Postgres   │        │    Redis     │      │  mock-gateway  │
      │              │        │              │      │  (provided)    │
      │ source of    │        │ seat-map     │      │  charge / otp  │
      │ truth        │        │ read cache   │      └───────┬────────┘
      │ holds,       │        │ rate limits  │              │ callback
      │ bookings,    │        └──────────────┘              │ (2–15s late,
      │ payments,    │                                      │  8% twice)
      │ callbacks    │◀──────┐                              │
      └───────▲──────┘       │                    ┌─────────▼────────┐
              │              └────────────────────│  POST /api/      │
      ┌───────┴──────┐                            │  webhooks/       │
      │   worker     │  hold-expiry sweeper       │  payments        │
      │  (own image) │  payment reconciler        │  always 200      │
      └──────────────┘                            └──────────────────┘
```

Full diagram sources: [`docs/diagrams/architecture.mmd`](docs/diagrams/architecture.mmd) ·
[`docs/diagrams/pipeline.mmd`](docs/diagrams/pipeline.mmd).
Longer write-up in [`docs/architecture.md`](docs/architecture.md).

**It is a modular monolith, on purpose.** One API image with hard internal module
boundaries (`catalog`, `seating`, `booking`, `payment`), plus a separate `worker` image
running from the same code. We did not split into services because the entire correctness
problem — hold, book, pay — lives inside one transactional boundary, and splitting it would
have meant inventing a distributed commit protocol to solve a problem Postgres already
solves in one statement. The full argument, including what we gave up, is in
[`DECISIONS.md`](DECISIONS.md).

---

## How we never double-book

The invariant is enforced in **one place**: the database.

```sql
-- One partial unique index. Not application logic, not a mutex, not a Redis lock.
CREATE UNIQUE INDEX seat_claim_unique
    ON seat_claims (showtime_id, seat_id)
 WHERE state IN ('HELD', 'BOOKED');
```

A hold is a single statement:

```sql
INSERT INTO seat_claims (showtime_id, seat_id, hold_id, state, expires_at)
VALUES ($1, $2, $3, 'HELD', now() + ($4 || ' seconds')::interval)
ON CONFLICT DO NOTHING
RETURNING *;
```

Zero rows returned means somebody else got there first, and the caller receives `409`.
There is no read-then-write window for a race to slip through, so 100 concurrent requests
for seat F12 produce exactly one winner regardless of how many API replicas are running.
Multi-seat holds claim seats in a **deterministic order (sorted by `seat_id`)** inside one
transaction, which makes deadlock between two overlapping multi-seat requests impossible.

Redis caches the seat map for fast reads and is **never** consulted to decide whether a
seat is free. If Redis is empty, cold, or wrong, the worst outcome is a stale seat map and
a `409` on hold — never an oversell.

Expired holds are reclaimed two ways, belt and braces:

1. **Lazily** — any read or claim treats a row with `expires_at < now()` as available.
2. **Actively** — the `worker` sweeps expired holds every `SWEEP_INTERVAL_MS` and flips them
   to `EXPIRED`, so the seat map goes green without waiting for a reader.

Correctness never depends on the sweeper running. The sweeper only makes the UI honest.

---

## How we survive the gateway

The gateway misbehaves by specification. Each documented behaviour maps to a specific defence:

| Documented behaviour | Our defence |
| --- | --- |
| Callback delayed 2–15s, **always** | `POST /pay` returns `202` immediately after persisting a `PENDING` payment. It never awaits the gateway. |
| Same callback delivered twice (8%) | `callback_events` has a unique index on `event_id`. The second delivery hits it, is logged, and returns `200` without touching the booking. |
| Payment `FAILED` (10%) | Booking → `PAYMENT_FAILED`, hold released immediately, seat returns to the map. |
| `/charge` 500s or times out (2%) | Bounded retry with jitter behind a circuit breaker. On exhaustion the booking stays `PENDING_PAYMENT` and the reconciler resolves it — we never guess. |
| Callback arrives **before** `/charge` returns (`X-Mock-Force: race`) | The payment row is written with our own `booking_ref` *before* `/charge` is called, so an early callback always finds a row to attach to. The late `payment_id` is reconciled on arrival. |
| OTP delayed or never delivered (10%) | OTP is not on the critical path for holding a seat. Resend is allowed and rate-limited; the hold timer is authoritative and shown to the user. |
| Gateway container **stopped entirely** | Browse, seat map, and hold are fully functional. `/health` stays green — it does not probe the gateway. Payment attempts fail fast (open circuit) with `503` and a clear message, never a 500 or a hang. Pending payments recover when the gateway returns. |

**The callback handler always returns `200`.** Every path — duplicate, unknown `booking_ref`,
malformed body, bad signature — is recorded and answered `200`, because a non-200 makes the
gateway retry forever. Anything we could not process lands in `callback_events` with
`status = 'REJECTED'` and a reason, so nothing is silently dropped.

Booking state machine (illegal transitions throw, and are unit-tested):

```
PENDING_PAYMENT ──▶ CONFIRMED ──▶ REFUNDED
       │
       ├──▶ PAYMENT_FAILED
       └──▶ EXPIRED            (hold ran out before payment completed)
```

---

## API reference

Base URL: `http://localhost:8080/api`. Full detail in [`docs/api.md`](docs/api.md).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. `200` in <1s, green even with the gateway down. |
| `GET` | `/ready` | Readiness — checks Postgres and Redis. Used by the load balancer. |
| `GET` | `/metrics` | Prometheus metrics. |
| `GET` | `/api/movies` | Browse movies. |
| `GET` | `/api/movies/:id/showtimes` | Showtimes for a movie, with theatre. |
| `GET` | `/api/showtimes/:id/seatmap` | **Live seat map.** ← judging hook |
| `POST` | `/api/holds` | **Hold seats.** ← judging hook |
| `DELETE` | `/api/holds/:holdId` | Release a hold early. |
| `POST` | `/api/bookings` | Turn a hold into a booking, get a `booking_ref`. |
| `POST` | `/api/bookings/:ref/otp/send` | Send OTP (resendable). |
| `POST` | `/api/bookings/:ref/otp/verify` | Verify OTP. |
| `POST` | `/api/bookings/:ref/pay` | Start payment. Returns `202` immediately. |
| `GET` | `/api/bookings/:ref` | Poll booking + payment status, get the ticket QR. |
| `POST` | `/api/webhooks/payments` | Gateway callback. **Always `200`.** |

---

## Testing

```bash
cd backend
npm ci
npm test              # unit — fast, no containers
npm run test:integration   # spins up Postgres + Redis via testcontainers
npm run test:coverage
```

The tests that matter:

| File | What it proves |
| --- | --- |
| [`tests/integration/concurrent-hold.test.ts`](backend/tests/integration/concurrent-hold.test.ts) | 100 simultaneous holds on one seat → exactly 1 success, 99 × `409`, 0 oversell. |
| [`tests/integration/duplicate-callback.test.ts`](backend/tests/integration/duplicate-callback.test.ts) | Same `event_id` twice → one payment, one confirmation, revenue counted once, both `200`. |
| [`tests/integration/hold-expiry.test.ts`](backend/tests/integration/hold-expiry.test.ts) | Hold expires → seat available → a different user books it. |
| [`tests/integration/gateway-down.test.ts`](backend/tests/integration/gateway-down.test.ts) | Gateway unreachable → seat map + holds still work, `/health` green, no 500s. |
| [`tests/unit/booking-state-machine.test.ts`](backend/tests/unit/booking-state-machine.test.ts) | Every illegal transition is rejected. |

---

## Proof (Milestone 4)

Numbers, methodology and bottleneck analysis live in [`docs/proof/`](docs/proof/).
Load scripts are in [`load/`](load/) and are run **from the host, never from inside the
stack**, so we are not measuring k6 fighting the API for the same CPU.

| Scenario | Script | Report |
| --- | --- | --- |
| A — one seat, 100 buyers *(required)* | [`load/scenario-a-one-seat.js`](load/scenario-a-one-seat.js) | [`docs/proof/scenario-a-concurrency.md`](docs/proof/scenario-a-concurrency.md) |
| B — the abandoned hold *(required)* | [`load/scenario-b-hold-expiry.sh`](load/scenario-b-hold-expiry.sh) | [`docs/proof/scenario-b-hold-expiry.md`](docs/proof/scenario-b-hold-expiry.md) |
| C — find your breakpoint *(bonus)* | [`load/scenario-c-ramp.js`](load/scenario-c-ramp.js) | [`docs/proof/scenario-c-breakpoint.md`](docs/proof/scenario-c-breakpoint.md) |

```bash
# Scenario A
k6 run -e BASE_URL=http://localhost:8080 -e SEAT_LABEL=F12 load/scenario-a-one-seat.js

# Scenario B (needs the stack up with a short TTL)
HOLD_TTL_SECONDS=15 docker compose up -d --build
BASE_URL=http://localhost:8080 ./load/scenario-b-hold-expiry.sh
```

---

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) — runs on pull requests and on pushes to
`main`. Lint, typecheck, unit + integration tests, docker build. Change-aware: a docs-only PR
skips the backend job. Branch protection requires it to pass before merge.

[`.github/workflows/cd.yml`](.github/workflows/cd.yml) — runs **only** on pushes to `main`, after
CI is green. Builds and pushes images, then deploys over SSH with a rolling restart so the
service stays reachable. Pipeline diagram: [`docs/diagrams/pipeline.mmd`](docs/diagrams/pipeline.mmd).

---

## What works, what does not

### Works
- `TODO — fill in honestly before submission`

### Does not / known limits
- `TODO — an honest list scores better than an empty one`

### Attribution
- Mock payment/OTP gateway: `asifmahmoud414/mock-gateway` (provided by organisers)
- `TODO — list any other third-party code you pulled in`
