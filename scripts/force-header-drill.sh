#!/usr/bin/env bash
#
# Exercise every gateway force header end to end, the same way judges will.
# Run this before you believe anything, and again before code freeze.
#
#   ./scripts/force-header-drill.sh http://localhost:8080
#
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

# TODO: wire an internal test header (e.g. X-Test-Mock-Force) through your
# /pay route into gateway.client.ts, so these can be driven from outside.

drill() {
  local force="$1" expect="$2"
  echo "── X-Mock-Force: ${force} ────────────────────────────────"
  echo "   expect: ${expect}"
  # TODO: hold -> book -> pay with the header -> poll booking to a terminal
  #       state -> assert. Print the observed timeline.
  echo
}

drill success   "booking CONFIRMED, one payment, one callback APPLIED"
drill fail      "booking PAYMENT_FAILED, hold released, seat back on the map"
drill duplicate "two callbacks, both 200, one APPLIED + one DUPLICATE, revenue counted once"
drill timeout   "/charge times out, payment stays PENDING, reconciler settles it, no 500 to the user"
drill race      "callback lands before /charge returns, still attaches to the payment row"

echo "── gateway stopped ──────────────────────────────────────"
echo "   expect: /health 200, seat map + holds still work, pay -> 503, recovery on restart"
# docker compose stop gateway ; ... ; docker compose start gateway

echo
echo "Reminder: X-Mock-Mode: deterministic is for building only."
echo "Turn it off and run this again before you believe any of it."
