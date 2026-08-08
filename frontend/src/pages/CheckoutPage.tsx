/**
 * Hold countdown, OTP, payment.
 *
 * The two states that must be honest:
 *
 *   OTP not arriving      10% never do. Offer resend, keep the hold timer
 *                         visible, and never imply the seat is lost because a
 *                         text message is late.
 *
 *   Payment confirming    /pay returns 202, and the callback is 2-15 seconds
 *                         behind. Show an explicit "confirming your payment"
 *                         state and poll GET /api/bookings/:ref until it
 *                         reaches a terminal status.
 *
 * Never render "confirmed" before the server says CONFIRMED. That optimism is
 * exactly the bug in Zayan's night: the app said the seat was his, and a
 * refresh showed it gone.
 */
export {};
