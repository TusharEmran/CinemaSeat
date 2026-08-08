const db = require('../config/db');
const config = require('../config');
const bookingRepository = require('../repositories/bookingRepository');
const paymentRepository = require('../repositories/paymentRepository');
const seatRepository = require('../repositories/seatRepository');
const outboxRepository = require('../repositories/outboxRepository');
const gatewayClient = require('./gatewayClient');
const logger = require('../utils/logger');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/errors');

class PaymentService {
    async initiateCharge({ userId, bookingId, idempotencyKey }, mockHeaders = {}) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.user_id !== userId) {
            throw new NotFoundError('Booking not found');
        }

        if (booking.status === 'CONFIRMED') {
            throw new ConflictError('Booking is already confirmed');
        }

        if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
            throw new BadRequestError(`Cannot initiate payment for a ${booking.status.toLowerCase()} booking`);
        }

        // Charge Idempotency Check
        const existingPayment = await paymentRepository.findByIdempotencyKey(idempotencyKey);
        if (existingPayment) {
            logger.info(`Idempotent charge request matched existing payment ${existingPayment.id}`);
            return existingPayment;
        }

        const client = await db.getClient();
        let payment;

        try {
            await client.query('BEGIN');

            // Save local payment record FIRST to handle race condition where webhook arrives before HTTP response
            payment = await paymentRepository.createTx(client, {
                bookingId: booking.id,
                bookingRef: booking.booking_ref,
                amount: booking.total_amount,
                currency: 'BDT',
                idempotencyKey,
                status: 'PENDING',
            });

            await outboxRepository.createEventTx(client, {
                eventType: 'PaymentPending',
                aggregateType: 'Payment',
                aggregateId: payment.id,
                payload: {
                    payment_id: payment.id,
                    booking_id: booking.id,
                    booking_ref: booking.booking_ref,
                    amount: booking.total_amount,
                },
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        // Call External Gateway /charge
        const callbackUrl = `http://api:3000/webhooks/payment`;
        try {
            const gatewayRes = await gatewayClient.charge({
                amount: parseFloat(booking.total_amount),
                currency: 'BDT',
                bookingRef: booking.booking_ref,
                callbackUrl,
                idempotencyKey,
            }, mockHeaders);

            if (gatewayRes.data && gatewayRes.data.payment_id) {
                await paymentRepository.updateGatewayPaymentId(payment.id, gatewayRes.data.payment_id);
                payment.gateway_payment_id = gatewayRes.data.payment_id;
            }

            return payment;
        } catch (err) {
            logger.error(`Gateway charge call failed for booking ${booking.booking_ref}:`, err.message);
            throw err;
        }
    }

    async processWebhookCallback(payload) {
        const { event_id: eventId, payment_id: gatewayPaymentId, booking_ref: bookingRef, status, reason } = payload;

        if (!eventId || !bookingRef || !status) {
            throw new BadRequestError('Invalid webhook payload structure');
        }

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Find payment by booking_ref (pre-persisted record)
            const payment = await paymentRepository.findByBookingRef(bookingRef, client);

            // Deduplicate event_id using payment_events table
            const isFirstTime = await paymentRepository.recordPaymentEventTx(client, {
                eventId,
                paymentId: payment ? payment.id : null,
                bookingRef,
                status,
                payload,
            });

            if (!isFirstTime) {
                await client.query('COMMIT');
                logger.info(`Duplicate webhook callback event ${eventId} ignored.`);
                return { duplicate: true, success: true };
            }

            if (!payment) {
                await client.query('COMMIT');
                logger.warn(`Received webhook callback for unknown booking_ref ${bookingRef}`);
                return { success: false, reason: 'Booking ref not found' };
            }

            const booking = await bookingRepository.findByRef(bookingRef, client);
            if (!booking) {
                await client.query('COMMIT');
                return { success: false, reason: 'Booking record not found' };
            }

            // State Machine Check: Do not allow invalid transitions
            if (payment.status === 'SUCCEEDED' && status === 'SUCCEEDED') {
                await client.query('COMMIT');
                return { duplicate: true, success: true };
            }

            if (status === 'SUCCEEDED') {
                // Update Payment -> SUCCEEDED
                await paymentRepository.updateStatusTx(client, {
                    paymentId: payment.id,
                    status: 'SUCCEEDED',
                    gatewayPaymentId,
                });

                // Update Booking -> CONFIRMED
                await bookingRepository.updateStatusTx(client, {
                    bookingId: booking.id,
                    status: 'CONFIRMED',
                });

                // Update ShowSeats -> BOOKED
                const showSeatIds = await bookingRepository.findBookingShowSeats(booking.id, client);
                if (showSeatIds.length > 0) {
                    await seatRepository.updateSeatsStatusTx(client, {
                        showSeatIds,
                        newStatus: 'BOOKED',
                        holdUntil: null,
                    });
                }

                // Write Outbox Events for notifications and analytics
                await outboxRepository.createEventTx(client, {
                    eventType: 'PaymentSucceeded',
                    aggregateType: 'Payment',
                    aggregateId: payment.id,
                    payload: {
                        payment_id: payment.id,
                        booking_id: booking.id,
                        booking_ref: booking.booking_ref,
                        amount: payment.amount,
                    },
                });

                await outboxRepository.createEventTx(client, {
                    eventType: 'BookingConfirmed',
                    aggregateType: 'Booking',
                    aggregateId: booking.id,
                    payload: {
                        booking_id: booking.id,
                        booking_ref: booking.booking_ref,
                        user_id: booking.user_id,
                        qr_payload: `CS-CONFIRMED-${booking.booking_ref}`,
                    },
                });

                logger.info(`Payment & Booking CONFIRMED for ${booking.booking_ref}`);
            } else if (status === 'FAILED') {
                // Update Payment -> FAILED
                await paymentRepository.updateStatusTx(client, {
                    paymentId: payment.id,
                    status: 'FAILED',
                    reason: reason || 'Payment failed at gateway',
                    gatewayPaymentId,
                });

                // Update Booking -> CANCELLED
                await bookingRepository.updateStatusTx(client, {
                    bookingId: booking.id,
                    status: 'CANCELLED',
                });

                // Release seats -> AVAILABLE
                const showSeatIds = await bookingRepository.findBookingShowSeats(booking.id, client);
                if (showSeatIds.length > 0) {
                    await seatRepository.updateSeatsStatusTx(client, {
                        showSeatIds,
                        newStatus: 'AVAILABLE',
                        holdUntil: null,
                    });
                }

                // Write Outbox Event
                await outboxRepository.createEventTx(client, {
                    eventType: 'PaymentFailed',
                    aggregateType: 'Payment',
                    aggregateId: payment.id,
                    payload: {
                        payment_id: payment.id,
                        booking_id: booking.id,
                        booking_ref: booking.booking_ref,
                        reason: reason || 'Payment failed at gateway',
                    },
                });

                logger.info(`Payment FAILED for ${booking.booking_ref}. Seats released.`);
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('Error processing payment webhook callback:', err.message);
            throw err;
        } finally {
            client.release();
        }
    }

    async requestRefund({ paymentId, amount, reason, userId }) {
        const payment = await paymentRepository.findById(paymentId);
        if (!payment) {
            throw new NotFoundError('Payment not found');
        }

        if (payment.status !== 'SUCCEEDED') {
            throw new ConflictError(`Cannot refund payment in ${payment.status} status`);
        }

        const gatewayRes = await gatewayClient.refund({
            paymentId: payment.gateway_payment_id || payment.id,
            amount: amount || parseFloat(payment.amount),
            reason: reason || 'Customer requested refund',
        });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const updatedPayment = await paymentRepository.updateStatusTx(client, {
                paymentId: payment.id,
                status: 'REFUNDED',
                reason: reason || 'Customer requested refund',
            });

            await bookingRepository.updateStatusTx(client, {
                bookingId: payment.booking_id,
                status: 'CANCELLED',
            });

            const showSeatIds = await bookingRepository.findBookingShowSeats(payment.booking_id, client);
            if (showSeatIds.length > 0) {
                await seatRepository.updateSeatsStatusTx(client, {
                    showSeatIds,
                    newStatus: 'AVAILABLE',
                    holdUntil: null,
                });
            }

            await outboxRepository.createEventTx(client, {
                eventType: 'PaymentRefunded',
                aggregateType: 'Payment',
                aggregateId: payment.id,
                payload: {
                    payment_id: payment.id,
                    booking_id: payment.booking_id,
                    amount: payment.amount,
                    reason,
                },
            });

            await client.query('COMMIT');
            return updatedPayment;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getPaymentById(paymentId) {
        const payment = await paymentRepository.findById(paymentId);
        if (!payment) {
            throw new NotFoundError('Payment not found');
        }
        return payment;
    }
}

module.exports = new PaymentService();
