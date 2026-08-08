#!/usr/bin/env bash
#
# Scenario B — The abandoned hold.  REQUIRED.
#
# User A holds a seat and walks away. The hold expires. User B books it.
# Prints a timestamped timeline you can paste straight into
# docs/proof/scenario-b-hold-expiry.md.
#
# Bring the stack up with a short TTL first, so this finishes in under a minute:
#
#   HOLD_TTL_SECONDS=15 docker compose up -d --build
#   BASE_URL=http://localhost:8080 ./load/scenario-b-hold-expiry.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
SHOWTIME_ID="${SHOWTIME_ID:-11111111-1111-1111-1111-111111111111}"
SEAT_LABEL="${SEAT_LABEL:-F12}"
TTL="${HOLD_TTL_SECONDS:-15}"

ts() { date -u +"%H:%M:%S.%3N"; }
step() { printf '[%s] %s\n' "$(ts)" "$1"; }

seat_status() {
  curl -sS "${BASE_URL}/api/showtimes/${SHOWTIME_ID}/seatmap" \
    | grep -o "\"label\":\"${SEAT_LABEL}\"[^}]*" \
    | grep -o '"status":"[A-Z_]*"' \
    | head -n1
}

echo "═══════════ Scenario B: the abandoned hold ═══════════"
echo "seat ${SEAT_LABEL} · showtime ${SHOWTIME_ID} · HOLD_TTL_SECONDS=${TTL}"
echo

step "t0  seat status before anything: $(seat_status)"

step "t0  user A holds ${SEAT_LABEL}"
HOLD_A=$(curl -sS -X POST "${BASE_URL}/api/holds" \
  -H 'Content-Type: application/json' \
  -d "{\"showtime_id\":\"${SHOWTIME_ID}\",\"seat_labels\":[\"${SEAT_LABEL}\"],\"user_ref\":\"user-a\"}")
echo "         $HOLD_A"

step "     seat status while held: $(seat_status)   (expect HELD)"

step "     user B tries the same seat while A holds it"
B_EARLY=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/holds" \
  -H 'Content-Type: application/json' \
  -d "{\"showtime_id\":\"${SHOWTIME_ID}\",\"seat_labels\":[\"${SEAT_LABEL}\"],\"user_ref\":\"user-b\"}")
echo "         HTTP ${B_EARLY}   (expect 409)"

step "     user A walks away. Waiting ${TTL}s + 3s grace for the hold to expire…"
sleep "$((TTL + 3))"

step "     seat status after expiry: $(seat_status)   (expect AVAILABLE)"

step "     user B holds the released seat"
HOLD_B=$(curl -sS -X POST "${BASE_URL}/api/holds" \
  -H 'Content-Type: application/json' \
  -d "{\"showtime_id\":\"${SHOWTIME_ID}\",\"seat_labels\":[\"${SEAT_LABEL}\"],\"user_ref\":\"user-b\"}")
echo "         $HOLD_B"

# TODO: continue user B through booking -> pay -> callback, then assert the
# booking reads CONFIRMED. That is the "successfully booked by a different
# user" half of the evidence the brief asks for.

echo
echo "═════════════════════ done ═══════════════════════════"
