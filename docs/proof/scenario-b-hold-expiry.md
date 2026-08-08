# Scenario B — The abandoned hold

**Required.** Hold a seat, walk away, prove it comes back and that someone else can book it.

---

## Method

- **Seat:** `F12`, showtime `11111111-1111-1111-1111-111111111111`
- **`HOLD_TTL_SECONDS`:** `TODO — the short value you ran with, e.g. 15`
- **Script:** [`load/scenario-b-hold-expiry.sh`](../../load/scenario-b-hold-expiry.sh)

```bash
HOLD_TTL_SECONDS=15 docker compose up -d --build
BASE_URL=<url> ./load/scenario-b-hold-expiry.sh
```

The TTL is read from the environment at startup and is not hardcoded anywhere — see
[`backend/src/config/env.ts`](../../backend/src/config/env.ts). That is what makes this scenario
runnable in under a minute.

---

## Observed timeline

`TODO — paste the real timestamped output. This table is the deliverable.`

| Time (UTC) | Event | Evidence |
| --- | --- | --- |
| `T+0.000` | Seat map before: `F12` = `AVAILABLE` | `TODO` |
| `T+0.0xx` | User A holds `F12` → `201`, `expires_at = T+15s` | `TODO` |
| `T+0.1xx` | Seat map: `F12` = `HELD` | `TODO` |
| `T+0.2xx` | User B attempts the same seat → `409 SEAT_UNAVAILABLE` | `TODO` |
| `T+15.0xx` | TTL passes. User A never paid. | — |
| `T+15.xxx` | Worker sweep flips the claim to `EXPIRED` | `TODO — worker log line` |
| `T+16.xxx` | Seat map: `F12` = `AVAILABLE` again | `TODO` |
| `T+16.xxx` | User B holds `F12` → `201` | `TODO` |
| `T+1x.xxx` | User B pays, callback arrives, booking `CONFIRMED` | `TODO` |

**Observed reclaim latency:** `TODO` seconds after expiry.

---

## Evidence the seat genuinely returned

```jsonc
// Seat map after expiry — TODO paste
```

```jsonc
// User B's confirmed booking — TODO paste. This is the half of the evidence
// teams most often forget: "available again" is not the same as "booked by
// someone else".
```

---

## How reclaim actually works

Two independent mechanisms, and it is worth being able to explain why both exist:

1. **Lazy.** Any read or claim treats a row with `expires_at < now()` as available. This means
   correctness does not depend on the worker being alive — if the sweeper were dead, User B
   would still have been able to hold the seat.
2. **Active.** The worker sweeps expired holds every `SWEEP_INTERVAL_MS`, so the seat map goes
   green on its own without waiting for someone to read it.

`TODO — confirm you observed the lazy path independently, e.g. by stopping the worker and
checking that a hold on the expired seat still succeeds. That single extra check is what
separates "it worked" from "we understand why it worked".`
