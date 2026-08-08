/**
 * The only file that knows the API exists.
 *
 * Base URL is `/api` — same origin, through the proxy. The frontend never
 * learns the API host, so there is nothing to reconfigure between local and
 * deployed.
 *
 * Two rules this client enforces for callers:
 *   - a 409 on hold is a RESULT, not an exception. Return it typed; do not
 *     throw, or every call site grows a try/catch around normal behaviour.
 *   - /pay returns 202, never an outcome. Callers must poll the booking.
 */
export {};
// TODO: getMovies(), getShowtimes(movieId), getSeatMap(showtimeId),
//       holdSeats({ showtimeId, seatLabels, userRef }),
//       releaseHold(holdId), createBooking(holdId, phone),
//       sendOtp(ref), verifyOtp(ref, code), pay(ref), getBooking(ref)
