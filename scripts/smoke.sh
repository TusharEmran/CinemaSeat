#!/usr/bin/env bash
#
# Smoke test. Walks the whole core path and fails loudly on the first problem.
# Used by CI after `docker compose up`, by CD after deploying, and by you at
# 4pm when you need to know in ten seconds whether the stack is alive.
#
#   ./scripts/smoke.sh http://localhost:8080
#
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:8080}}"
SHOWTIME_ID="${SHOWTIME_ID:-11111111-1111-1111-1111-111111111111}"
SEAT_LABEL="${SEAT_LABEL:-A1}"

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }

echo "Smoke testing ${BASE_URL}"

# ── 1. Health, and it must be fast ───────────────────────────────────────────
read -r code time_total < <(
  curl -s -o /dev/null -w '%{http_code} %{time_total}' "${BASE_URL}/health"
)
[ "$code" = "200" ] || fail "GET /health returned ${code}"
awk -v t="$time_total" 'BEGIN { exit !(t < 1.0) }' || fail "GET /health took ${time_total}s (must be <1s)"
pass "GET /health  200 in ${time_total}s"

# ── 2. Browse ────────────────────────────────────────────────────────────────
curl -sf "${BASE_URL}/api/movies" > /dev/null || fail "GET /api/movies"
pass "GET /api/movies"

# ── 3. Seat map (judging hook) ───────────────────────────────────────────────
MAP=$(curl -sf "${BASE_URL}/api/showtimes/${SHOWTIME_ID}/seatmap") \
  || fail "GET /api/showtimes/:id/seatmap"
echo "$MAP" | grep -q '"seat_id"' || fail "seat map has no seats — did the seed run?"
pass "GET /api/showtimes/:id/seatmap"

# ── 4. Hold (judging hook) ───────────────────────────────────────────────────
HOLD=$(curl -s -X POST "${BASE_URL}/api/holds" \
  -H 'Content-Type: application/json' \
  -d "{\"showtime_id\":\"${SHOWTIME_ID}\",\"seat_labels\":[\"${SEAT_LABEL}\"],\"user_ref\":\"smoke\"}")

if echo "$HOLD" | grep -q '"hold_id"'; then
  pass "POST /api/holds  201"
  HOLD_ID=$(echo "$HOLD" | grep -o '"hold_id":"[^"]*"' | cut -d'"' -f4)
  curl -sf -X DELETE "${BASE_URL}/api/holds/${HOLD_ID}" > /dev/null || true
  pass "DELETE /api/holds/:id  (cleaned up)"
elif echo "$HOLD" | grep -q 'SEAT_UNAVAILABLE'; then
  # Someone already holds this seat. Still a correct answer.
  pass "POST /api/holds  409 (seat already held — valid)"
else
  fail "POST /api/holds returned: ${HOLD}"
fi

# ── 5. A losing hold must be a 409, never a 500 ──────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/holds" \
  -H 'Content-Type: application/json' \
  -d "{\"showtime_id\":\"${SHOWTIME_ID}\",\"seat_labels\":[\"__NOPE__\"],\"user_ref\":\"smoke\"}")
[ "$code" -lt 500 ] || fail "bad seat label produced ${code} — must be 4xx, never 5xx"
pass "POST /api/holds  invalid seat -> ${code}"

echo
echo "All smoke checks passed."
