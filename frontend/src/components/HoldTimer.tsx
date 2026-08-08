/**
 * Counts down to the hold's expires_at.
 *
 * Anchored to the server_time the seat map returned, not to the browser clock —
 * a user whose laptop is two minutes fast must not see a timer that lies.
 *
 * On zero: say the seat is gone and stop. Do not keep counting into negative
 * numbers, and do not let the user proceed to payment on a dead hold.
 */
export {};
