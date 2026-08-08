# Runbook

The page you open when something is on fire and there are two hours left.

---

## Deployment is reproducible from a clean clone

The lab is a clock: 12 hours from launch, no extension, and when it ends the VM and the AWS
account both disappear. **If it is not in the repository, it does not survive.**

No hand-configured servers. No manual step that is not written here.

```bash
# On the infrastructure owner's VM — and only theirs. That lab is not used for
# experiments, not stopped, not restarted.
git clone <repo-url> && cd CinemaSeat
docker compose -f docker-compose.yml -f infra/compose/compose.prod.yml up -d --build
./scripts/smoke.sh http://<public-ip>:8080
```

---

## Health checks

```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' http://localhost:8080/health
curl -s http://localhost:8080/ready | jq
```

`/health` green + `/ready` red means a dependency is down but the process is fine — do not
restart the container, fix the dependency.

---

## Symptoms

### Holds are returning 500 instead of 409

A lost race is not an error. A `500` here means the `ON CONFLICT DO NOTHING` path is throwing
instead of returning zero rows. Check that the insert is not wrapped in something that treats a
zero-row result as an exception.

### Seat shows HELD but nobody holds it

The sweeper is behind or dead.

```bash
docker compose logs worker --tail 100
docker compose ps worker
```

Readers should already be treating expired rows as available, so if a *hold request* on that
seat also fails, the bug is in the reader predicate, not the worker.

### Bookings stuck PENDING_PAYMENT

Callbacks are not arriving.

```bash
# Did we ever hear anything?
docker compose exec postgres psql -U cinema -d cinemaseat \
  -c "SELECT outcome, count(*) FROM callback_events GROUP BY 1;"

# Is PUBLIC_BASE_URL reachable *from the gateway container*?
docker compose exec gateway wget -qO- http://api:3000/health
```

The usual cause: `PUBLIC_BASE_URL` set to `localhost`. Inside the gateway container, localhost
is the gateway.

### Gateway is down

Expected behaviour, and it is graded: browse, seat map and holds keep working, `/health` stays
green, payments fail fast with `503`, and pending payments recover when it returns.

```bash
docker compose stop gateway     # verify the above
docker compose start gateway    # watch the reconciler drain the PENDING queue
```

### Everything is slow

```bash
docker stats --no-stream
docker compose exec postgres psql -U cinema -d cinemaseat \
  -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY 1;"
```

Many `idle in transaction` → a transaction is being held open across an await it should not be.
Many `active` on the same relation → row contention, which is expected on the hot seat.

---

## Useful queries

```sql
-- The oversell check. Must return zero rows. Always.
SELECT showtime_id, seat_id, count(*)
  FROM seat_claims
 WHERE state IN ('HELD','BOOKED')
 GROUP BY 1,2
HAVING count(*) > 1;

-- Duplicate callbacks absorbed
SELECT outcome, count(*) FROM callback_events GROUP BY 1;

-- Payments the reconciler still owes an answer for
SELECT booking_ref, status, created_at FROM payments
 WHERE status = 'PENDING' AND created_at < now() - interval '1 minute';
```

---

## Reset to a clean state

```bash
docker compose down -v && docker compose up --build
```

`-v` drops the Postgres volume, so migrations and the seed run fresh.

---

## Before the code freeze

- [ ] `docker compose up` verified on a genuinely clean clone, in a fresh directory
- [ ] Deployed URL in `README.md` and reachable from a phone on mobile data
- [ ] Scenario A and B numbers written into `docs/proof/`
- [ ] `DECISIONS.md` filled in with the arguments actually had
- [ ] Force headers exercised: `fail`, `duplicate`, `timeout`, `race`
- [ ] **Deterministic mode turned OFF**, and the whole flow re-run under real misbehaviour
- [ ] Repo is public
- [ ] Nothing pushed to the default branch after freeze
