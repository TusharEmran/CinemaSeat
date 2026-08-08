# API reference

Base URL: `http://localhost:8080/api` (single base URL, everything behind the proxy).

All bodies are JSON. All errors share one shape:

```jsonc
{
  "error": "SEAT_UNAVAILABLE",
  "message": "Seat F12 is no longer available",
  "request_id": "01J…"
}
```

Money is always **integer minor units** (`45000` = 450.00 BDT). No floats.

---

## Judging hooks

The two requests judges point tests at are documented in [`../README.md`](../README.md) and must
match it exactly. If you change a shape, change it there in the same commit.

---

## Health

### `GET /health`

Liveness. `200` in under a second, and **still `200` when the gateway is down** — it checks
nothing external.

```jsonc
{ "status": "ok", "uptime_seconds": 1423 }
```

### `GET /ready`

Readiness. Checks Postgres and Redis with short timeouts. `503` when a dependency is unusable.
This is what the load balancer polls, so a draining instance can fail readiness while `/health`
stays green.

### `GET /metrics`

Prometheus exposition format.

---

## Catalog

### `GET /api/movies`
### `GET /api/movies/:movieId/showtimes`
### `GET /api/theatres`

Read-only, cacheable, independent of the gateway. These keep working when the gateway is
stopped and when the premiere showtime is being hammered.

---

## Seating

### `GET /api/showtimes/:showtimeId/seatmap`

The live seat map. `status` is `AVAILABLE` · `HELD` · `BOOKED`.

A claim whose `expires_at` has passed reads as `AVAILABLE` even before the sweeper flips it —
the map must never show a seat as taken when the next hold request would succeed on it.

`server_time` is returned so the client can render the hold countdown without trusting its own
clock.

### `POST /api/holds`

| Code | Meaning |
| --- | --- |
| `201` | Held. Body carries `hold_id`, `expires_at`, per-seat prices and the total. |
| `409` | `SEAT_UNAVAILABLE` — someone else won. The expected answer for 99 of 100 concurrent requests. |
| `422` | `VALIDATION_FAILED` — unknown seat label, empty list, or over `MAX_SEATS_PER_HOLD`. |
| `429` | Rate limited at the edge. |

Multi-seat holds are **all or nothing**. If any seat is taken the whole transaction rolls back,
because handing back a partial row would strand seats and confuse the user.

`Idempotency-Key` (optional) makes a retried request return the original hold rather than
attempting a second claim.

### `DELETE /api/holds/:holdId`

Release early. Idempotent — releasing an already-released hold is `204`, not an error.

---

## Booking

### `POST /api/bookings`

Turns a hold into a booking and returns a `booking_ref`. Fails with `410 HOLD_EXPIRED` if the
hold died while the user was typing.

### `POST /api/bookings/:ref/otp/send` · `POST /api/bookings/:ref/otp/verify`

10% of OTPs are delayed or never delivered, by specification. Resend is allowed and rate
limited. **OTP is not on the seat-holding critical path** — a missing OTP must never cost the
user the seat they already hold.

### `POST /api/bookings/:ref/pay`

Returns **`202 Accepted` immediately**. It does not wait for the gateway — the callback is 2–15
seconds behind by specification, and blocking here would hold a connection open for the whole
window and collapse under load.

```jsonc
{ "booking_ref": "bk_001", "payment_status": "PENDING", "poll": "/api/bookings/bk_001" }
```

`503 GATEWAY_UNAVAILABLE` when the circuit breaker is open. Honest and fast, never a 500 and
never a hang.

### `GET /api/bookings/:ref`

Poll for the outcome. Terminal statuses: `CONFIRMED`, `PAYMENT_FAILED`, `EXPIRED`, `REFUNDED`.
`ticket_qr` appears on `CONFIRMED`.

---

## Gateway callback

### `POST /api/webhooks/payments`

```jsonc
{ "event_id": "evt_001", "payment_id": "pay_xyz",
  "booking_ref": "bk_001", "status": "SUCCEEDED", "amount": 450 }
```

**Always returns `200`.** Duplicate, unknown `booking_ref`, malformed body, bad signature,
internal error — all recorded in `callback_events` and answered `200`. A non-200 tells the
gateway delivery failed and it retries forever.

| Outcome recorded | When |
| --- | --- |
| `APPLIED` | First delivery, valid, transition legal. |
| `DUPLICATE` | `event_id` already seen. Nothing else is touched. |
| `REJECTED` | Unknown ref, bad signature, malformed body, or illegal transition — with a reason. |

Nothing is ever silently dropped.

---

## Testing against the gateway

Force headers are passed through from an internal test header so the full path can be exercised
end to end:

| Header | Effect |
| --- | --- |
| `X-Mock-Mode: deterministic` | 2s delay, always succeeds, no duplicates. **Build with this, then turn it off before you believe anything.** |
| `X-Mock-Force: fail` | Guaranteed failure |
| `X-Mock-Force: duplicate` | Guaranteed duplicate callback |
| `X-Mock-Force: timeout` | Guaranteed timeout on `/charge` |
| `X-Mock-Force: race` | Callback arrives before `/charge` returns |
| `X-Mock-Force: success` | Guaranteed clean success |
