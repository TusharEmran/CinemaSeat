const bookingService = require('../services/bookingService');

class BookingController {
    async createHold(req, res, next) {
        try {
            const { seat_ids } = req.body;
            const { showId } = req.params;
            const userId = req.user ? req.user.id : 'a1111111-1111-1111-1111-111111111111'; // Default demo user if unauthenticated in dev

            const result = await bookingService.createHold({
                userId,
                showId,
                seatIds: seat_ids,
            });

            return res.status(201).json({
                success: true,
                data: {
                    booking_id: result.booking.id,
                    booking_ref: result.booking.booking_ref,
                    status: result.booking.status,
                    total_amount: result.booking.total_amount,
                    hold_until: result.hold_until,
                    seats: result.seats,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    async getBookingById(req, res, next) {
        try {
            const userId = req.user ? req.user.id : null;
            const booking = await bookingService.getBookingById(req.params.id, userId);
            return res.status(200).json({ success: true, data: booking });
        } catch (err) {
            next(err);
        }
    }

    async getUserBookings(req, res, next) {
        try {
            const userId = req.params.userId || (req.user ? req.user.id : null);
            const bookings = await bookingService.getUserBookings(userId);
            return res.status(200).json({ success: true, data: bookings });
        } catch (err) {
            next(err);
        }
    }

    async cancelBooking(req, res, next) {
        try {
            const userId = req.user ? req.user.id : null;
            const booking = await bookingService.cancelBooking(req.params.id, userId);
            return res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully',
                data: booking,
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new BookingController();
