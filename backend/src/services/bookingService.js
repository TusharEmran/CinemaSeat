const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const config = require('../config');
const showRepository = require('../repositories/showRepository');
const seatRepository = require('../repositories/seatRepository');
const bookingRepository = require('../repositories/bookingRepository');
const outboxRepository = require('../repositories/outboxRepository');
const logger = require('../utils/logger');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/errors');

class BookingService {
    async createHold({ userId, showId, seatIds }) {
        if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            throw new BadRequestError('seatIds array is required and must not be empty');
        }

        const show = await showRepository.findById(showId);
        if (!show) {
            throw new NotFoundError('Show not found');
        }

        const holdMinutes = config.booking.holdDurationMinutes;
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Atomic SQL update attempt to hold seats
            const heldSeats = await seatRepository.holdSeatsTx(client, {
                showId,
                seatIds,
                holdMinutes,
            });

            if (heldSeats.length !== seatIds.length) {
                await client.query('ROLLBACK');
                throw new ConflictError('One or more selected seats are unavailable or currently held by another user');
            }

            // Calculate total price
            const totalAmount = heldSeats.reduce((sum, seat) => sum + parseFloat(seat.price), 0);
            const bookingRef = `bk_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

            // Create Booking in PENDING status
            const booking = await bookingRepository.createTx(client, {
                bookingRef,
                userId,
                showId,
                totalAmount,
                status: 'PENDING',
            });

            // Create BookingSeats records
            const bookingSeatsData = heldSeats.map(seat => ({
                bookingId: booking.id,
                showSeatId: seat.id,
                price: seat.price,
            }));
            await bookingRepository.addBookingSeatsTx(client, bookingSeatsData);

            // Create Outbox Event
            const outboxPayload = {
                booking_id: booking.id,
                booking_ref: booking.booking_ref,
                user_id: userId,
                show_id: showId,
                total_amount: totalAmount,
                seat_ids: seatIds,
                hold_until: heldSeats[0].hold_until,
            };

            await outboxRepository.createEventTx(client, {
                eventType: 'BookingCreated',
                aggregateType: 'Booking',
                aggregateId: booking.id,
                payload: outboxPayload,
            });

            await client.query('COMMIT');
            logger.info(`Successfully held ${seatIds.length} seats for booking ${booking.booking_ref}`);

            return {
                booking,
                seats: heldSeats,
                hold_until: heldSeats[0].hold_until,
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getBookingById(bookingId, userId = null) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (userId && booking.user_id !== userId) {
            throw new NotFoundError('Booking not found');
        }

        return booking;
    }

    async getUserBookings(userId) {
        return bookingRepository.findByUserId(userId);
    }

    async cancelBooking(bookingId, userId = null) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (userId && booking.user_id !== userId) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
            return booking;
        }

        if (booking.status === 'CONFIRMED') {
            throw new BadRequestError('Cannot cancel a confirmed booking directly. Please request a refund.');
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            await bookingRepository.updateStatusTx(client, { bookingId: booking.id, status: 'CANCELLED' });

            const showSeatIds = await bookingRepository.findBookingShowSeats(booking.id, client);
            if (showSeatIds.length > 0) {
                await seatRepository.updateSeatsStatusTx(client, {
                    showSeatIds,
                    newStatus: 'AVAILABLE',
                    holdUntil: null,
                });
            }

            await outboxRepository.createEventTx(client, {
                eventType: 'BookingCancelled',
                aggregateType: 'Booking',
                aggregateId: booking.id,
                payload: { booking_id: booking.id, booking_ref: booking.booking_ref, user_id: booking.user_id },
            });

            await client.query('COMMIT');
            logger.info(`Cancelled booking ${booking.booking_ref}`);
            return bookingRepository.findById(booking.id);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async expireStaleHoldsAndBookings() {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Expire stale ShowSeats
            const expiredSeats = await seatRepository.expireStaleHolds(client);

            // Find PENDING bookings that lost their seat holds
            const expiredBookings = await bookingRepository.findExpiredPendingBookings(client);

            for (const b of expiredBookings) {
                await bookingRepository.updateStatusTx(client, { bookingId: b.id, status: 'EXPIRED' });
                await outboxRepository.createEventTx(client, {
                    eventType: 'BookingExpired',
                    aggregateType: 'Booking',
                    aggregateId: b.id,
                    payload: { booking_id: b.id, booking_ref: b.booking_ref, show_id: b.show_id },
                });
            }

            await client.query('COMMIT');

            if (expiredSeats.length > 0 || expiredBookings.length > 0) {
                logger.info(`Hold Sweeper: Expired ${expiredSeats.length} seats and ${expiredBookings.length} bookings.`);
            }

            return { expiredSeatsCount: expiredSeats.length, expiredBookingsCount: expiredBookings.length };
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Error during hold sweeper execution:', err.message);
            throw err;
        } finally {
            client.release();
        }
    }
}

module.exports = new BookingService();
