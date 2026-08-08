/**
 * Renders rows of seats from GET /api/showtimes/:id/seatmap.
 *
 * AVAILABLE selectable · HELD and BOOKED are not.
 *
 * Polls every couple of seconds while mounted. Under a premiere rush the map
 * genuinely changes second to second, and a stale map is how you get a user
 * confidently tapping a seat that is already gone.
 */
export {};
