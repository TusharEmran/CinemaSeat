# CinemaSeat

A highly resilient, high-concurrency movie ticket booking system designed to strictly enforce seat inventory consistency during extreme traffic spikes, ensuring that the same seat is never sold twice.

> **Deployed URL:** `(https://6a1de20ca8dfd8790f50c930_5a61ce39.vscode.poridhi.io/proxy/8080)`

---

## Table of Contents

- [Deployment Instructions](#deployment-instructions)
- [Evaluation Endpoints](#evaluation-endpoints)
- [System Architecture](#system-architecture)
- [Concurrency & Data Integrity](#concurrency--data-integrity)
- [Resilience & Error Handling](#resilience--error-handling)
- [API Reference](#api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Performance Benchmarks (Milestone 4)](#performance-benchmarks-milestone-4)
- [CI/CD Pipeline](#cicd-pipeline)
- [Project Status & Attributions](#project-status--attributions)

---

## Deployment Instructions

The application is fully containerized and designed for a zero-configuration deployment.

```bash
git clone <repo-url>
cd CinemaSeat
docker compose up -d --build
```

**Bootstrapping Automation:**
There is no need to manually copy `.env` files, run migrations, or execute database seed scripts. A one-shot `migrate` service handles database schema migrations and automatically seeds the initial catalog (movies, theatres, showtimes, seat layouts, and pricing). The `api` and `worker` services wait for this initialization to complete before starting.

### Service Endpoints (Local)

| Service | Local URL |
| --- | --- |
| Frontend | <http://localhost:8080> |
| API Base URL | <http://localhost:8080/api> |
| Health Check | <http://localhost:8080/health> |
| Metrics | <http://localhost:8080/metrics> |
| Mock Gateway | <http://localhost:9000> |

**Hold Expiry Testing:**
To test the expiration of seat holds, you can override the default Time-To-Live (TTL) by setting the `HOLD_TTL_SECONDS` environment variable when spinning up the stack:

```bash
HOLD_TTL_SECONDS=15 docker compose up -d --build
```

---

## Evaluation Endpoints

### 1. Retrieve Live Seat Map

Fetches the current state of a showtime's seating arrangement, returning the status (`AVAILABLE`, `HELD`, `BOOKED`) of each seat.

```bash
curl -s http://localhost:8080/api/showtimes/11111111-1111-1111-1111-111111111111/seatmap
```

**Response Snapshot:**
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
*Note: `server_time` is provided to allow the client to render countdown timers accurately without relying on the local browser clock.*

### 2. Initiate a Seat Hold

Attempts to hold specific seats for a defined TTL.

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

**Success Response (`201 Created`)**
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

**Conflict Response (`409 Conflict`)**
When high concurrency results in multiple users requesting the same seat, only the first request succeeds. The others receive a definitive rejection.
```jsonc
{
  "error": "SEAT_UNAVAILABLE",
  "message": "Seat F12 is no longer available",
  "conflicting_seats": ["F12"],
  "request_id": "01J…"
}
```
*Design Decision: The `409` response is deliberate and highly performant. There is no queue or costly retry loop; conflicting requests are dismissed immediately.*

---

## System Architecture

```text
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

The system is designed as a **modular monolith**. The API uses hard internal boundaries (`catalog`, `seating`, `booking`, `payment`), and a separate `worker` service handles background reconciliation using the same code base. We opted against microservices because the complete business workflow (hold, book, pay) fundamentally belongs within a single transactional boundary. Using PostgreSQL's robust transaction handling avoids the complexity of distributed commit protocols while guaranteeing correctness.

For more details, see [`DECISIONS.md`](DECISIONS.md) and [`docs/architecture.md`](docs/architecture.md).

---

## Concurrency & Data Integrity

The absolute invariant—preventing double bookings—is enforced exclusively at the database level.

```sql
-- Partial unique index guaranteeing exclusivity
CREATE UNIQUE INDEX seat_claim_unique
    ON seat_claims (showtime_id, seat_id)
 WHERE state IN ('HELD', 'BOOKED');
```

Holding a seat relies on a single, atomic PostgreSQL operation:

```sql
INSERT INTO seat_claims (showtime_id, seat_id, hold_id, state, expires_at)
VALUES ($1, $2, $3, 'HELD', now() + ($4 || ' seconds')::interval)
ON CONFLICT DO NOTHING
RETURNING *;
```

**Key Characteristics:**
- **Zero Race Conditions**: Returning 0 rows immediately signifies that a concurrent request won the race, yielding a `409 Conflict`.
- **Deterministic Deadlock Prevention**: Multi-seat holds claim seats in a strictly deterministic order (sorted by `seat_id`).
- **Redis Dependency**: Redis acts purely as an optimization layer for fast reads and rate-limiting. It is **never** relied upon to determine true seat availability.
- **Expiry Sweep**: Expired holds are reclaimed lazily on read/claim operations and actively via a background sweeper.

---

## Resilience & Error Handling

The application robustly defends against external failures, specifically from unreliable mock payment gateways:

| Gateway Failure Scenario | System Defense Mechanism |
| --- | --- |
| **Delayed Callbacks (2–15s)** | `POST /pay` returns `202 Accepted` immediately upon persisting a `PENDING` payment. It does not await a synchronous response from the gateway. |
| **Duplicate Callbacks (8%)** | A unique index on `event_id` within the `callback_events` table ensures duplicate deliveries are logged and return `200 OK` without duplicating business logic. |
| **Failed Payments (10%)** | The booking state transitions to `PAYMENT_FAILED`, immediately releasing the hold and returning the seat to the available pool. |
| **/charge API Timeout/500 (2%)** | Utilizes a bounded retry mechanism with jitter behind a circuit breaker. If exhausted, the booking remains `PENDING_PAYMENT` until reconciled by background jobs. |
| **Race Conditions (Callback arrives first)** | The internal `booking_ref` is written *before* initiating `/charge`. Early callbacks reliably attach to the pre-written record, reconciling the `payment_id` later. |
| **OTP Delivery Failure (10%)** | OTP is decoupled from the critical path of holding a seat. Rate-limited resends are permitted, and the frontend relies on the server-provided hold expiration time. |
| **Gateway Unreachable** | The core application (browse, seat map, hold) remains fully functional. Health checks do not probe the gateway. Payment attempts fail fast with a `503` (open circuit). |

---

## API Reference

The primary Base URL is `/api`. Comprehensive documentation is available in [`docs/api.md`](docs/api.md).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe (<1s response time, independent of gateway). |
| `GET` | `/ready` | Readiness probe (verifies Postgres and Redis). |
| `GET` | `/metrics` | Exposes Prometheus metrics. |
| `GET` | `/api/movies` | Retrieves the movie catalog. |
| `GET` | `/api/movies/:id/showtimes` | Retrieves showtimes for a specific movie. |
| `GET` | `/api/showtimes/:id/seatmap` | **Live Seat Map Endpoint.** |
| `POST` | `/api/holds` | **Seat Hold Endpoint.** |
| `DELETE` | `/api/holds/:holdId` | Prematurely releases a seat hold. |
| `POST` | `/api/bookings` | Converts a hold to a booking. |
| `POST` | `/api/bookings/:ref/otp/send` | Dispatches an OTP. |
| `POST` | `/api/bookings/:ref/otp/verify` | Verifies an OTP. |
| `POST` | `/api/bookings/:ref/pay` | Initiates payment (Returns `202`). |
| `GET` | `/api/bookings/:ref` | Polls current booking and payment status. |
| `POST` | `/api/webhooks/payments` | Internal Gateway Callback hook. |

---

## Testing & Quality Assurance

```bash
cd backend
npm ci
npm test                   # Fast unit tests (no containers required)
npm run test:integration   # Integration tests (requires testcontainers)
npm run test:coverage      # Test coverage reports
```

**Critical Test Suites:**
- `concurrent-hold.test.ts`: Verifies that 100 simultaneous requests for one seat yield exactly 1 success and 99 `409` rejections.
- `duplicate-callback.test.ts`: Asserts idempotent handling of duplicate webhooks.
- `hold-expiry.test.ts`: Confirms that expired holds immediately revert to an available state.
- `gateway-down.test.ts`: Proves core functionality remains robust when external services fail.

---

## Performance Benchmarks (Milestone 4)

Load scripts are executed from the host machine to ensure accurate performance metrics without competing for container CPU. Raw reports and methodology analysis can be found in [`docs/proof/`](docs/proof/).

| Scenario | Load Script | Documentation |
| --- | --- | --- |
| Scenario A (One Seat, 100 Buyers) | `load/scenario-a-one-seat.js` | `docs/proof/scenario-a-concurrency.md` |
| Scenario B (Abandoned Hold) | `load/scenario-b-hold-expiry.sh` | `docs/proof/scenario-b-hold-expiry.md` |
| Scenario C (Breakpoint Ramp) | `load/scenario-c-ramp.js` | `docs/proof/scenario-c-breakpoint.md` |

---

## CI/CD Pipeline

- **Continuous Integration (`.github/workflows/ci.yml`)**: Executes on pull requests and pushes to `main`. Enforces linting, type-checking, unit, and integration tests.
- **Continuous Deployment (`.github/workflows/cd.yml`)**: Executes automatically on successful merges to `main`. Builds, pushes images, and deploys via SSH using rolling restarts to ensure zero downtime.

---

## Project Status & Attributions

### Completed Features
- Full catalog, hold, and booking flow integration.
- Strictly ACID-compliant concurrency handling using PostgreSQL unique constraints.
- NGINX Edge routing handling proxy path rewriting for resilient micro-frontends.
- Fallback mock integration for the unstable external gateway.

### Known Limitations
- `[INSERT KNOWN LIMITATIONS OR "None known at this time" HERE]`

### Attribution
- **Mock Gateway**: Provided by the hackathon organizers (`asifmahmoud414/mock-gateway`).
- **Load Generation**: Evaluated using Grafana `k6`.
- `[INSERT ADDITIONAL ATTRIBUTIONS HERE]`
