/**
 * GET    /api/showtimes/:showtimeId/seatmap   <- JUDGING HOOK
 * POST   /api/holds                           <- JUDGING HOOK
 * DELETE /api/holds/:holdId
 *
 * The exact request/response shapes are documented in README.md and must not
 * drift from it - judges point their tests at what the README says.
 *
 * POST /api/holds returns:
 *   201 + hold  on success
 *   409 SEAT_UNAVAILABLE  when someone else won the race (the expected answer
 *       for 99 of 100 concurrent requests - a clean rejection, never a 500)
 *   422 on validation failure
 */
export {};
