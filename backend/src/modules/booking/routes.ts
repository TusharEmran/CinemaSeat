/**
 * POST /api/bookings                 hold -> booking, returns booking_ref
 * GET  /api/bookings/:ref            poll status + ticket QR
 * POST /api/bookings/:ref/pay        starts payment, returns 202 IMMEDIATELY
 *
 * /pay must not await the gateway. The callback is 2-15s late by specification;
 * blocking here would hold a connection for the whole window and fall over
 * under load. Persist PENDING, fire the charge, return 202, let the callback
 * finish the job.
 */
export {};
