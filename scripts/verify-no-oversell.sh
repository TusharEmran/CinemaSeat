#!/usr/bin/env bash
#
# The one query that matters, run straight against the database.
# Returns zero rows, or the submission has a problem.
#
#   ./scripts/verify-no-oversell.sh
#
set -euo pipefail

echo "Checking for any seat claimed more than once…"

RESULT=$(docker compose exec -T postgres psql -U cinema -d cinemaseat -tA -c "
  SELECT showtime_id || ' ' || seat_id || ' claimed ' || count(*) || ' times'
    FROM seat_claims
   WHERE state IN ('HELD','BOOKED')
   GROUP BY showtime_id, seat_id
  HAVING count(*) > 1;
")

if [ -z "$RESULT" ]; then
  printf '\033[32mPASS\033[0m — no seat is claimed twice. Oversell count: 0\n'
else
  printf '\033[31mFAIL\033[0m — OVERSELL DETECTED:\n%s\n' "$RESULT"
  exit 1
fi

echo
echo "Callback event outcomes (duplicates should appear here, not in bookings):"
docker compose exec -T postgres psql -U cinema -d cinemaseat -c "
  SELECT outcome, count(*) FROM callback_events GROUP BY 1 ORDER BY 1;
"

echo "Confirmed bookings per hold (must be at most 1 each):"
docker compose exec -T postgres psql -U cinema -d cinemaseat -c "
  SELECT hold_id, count(*) FROM bookings
   WHERE status = 'CONFIRMED' GROUP BY 1 HAVING count(*) > 1;
"
