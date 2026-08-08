/**
 * Live seat map for one showtime. Select seats, hold them, go to checkout.
 *
 * The 409 is the interesting case, and the one worth building deliberately:
 * somebody else won the seat. Say so plainly, refresh the map, and let the user
 * pick again. It is not an error dialog and it is not a retry loop — it is the
 * normal outcome of a premiere rush, and the UI should feel like it expected it.
 */
export {};
