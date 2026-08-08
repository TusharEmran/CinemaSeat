const paymentService = require('../services/paymentService');
const { BadRequestError } = require('../utils/errors');

class PaymentController {
    async initiatePayment(req, res, next) {
        try {
            const { booking_id } = req.body;
            const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;

            if (!booking_id) {
                throw new BadRequestError('booking_id is required');
            }

            if (!idempotencyKey) {
                throw new BadRequestError('Idempotency-Key header or idempotency_key parameter is required');
            }

            const userId = req.user ? req.user.id : 'a1111111-1111-1111-1111-111111111111';

            // Extract mock mode headers if present
            const mockHeaders = {};
            if (req.headers['x-mock-mode']) mockHeaders['X-Mock-Mode'] = req.headers['x-mock-mode'];
            if (req.headers['x-mock-force']) mockHeaders['X-Mock-Force'] = req.headers['x-mock-force'];

            const payment = await paymentService.initiateCharge({
                userId,
                bookingId: booking_id,
                idempotencyKey,
            }, mockHeaders);

            return res.status(202).json({
                success: true,
                data: {
                    payment_id: payment.id,
                    gateway_payment_id: payment.gateway_payment_id,
                    booking_ref: payment.booking_ref,
                    amount: payment.amount,
                    status: payment.status,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    async getPaymentById(req, res, next) {
        try {
            const payment = await paymentService.getPaymentById(req.params.id);
            return res.status(200).json({ success: true, data: payment });
        } catch (err) {
            next(err);
        }
    }

    async requestRefund(req, res, next) {
        try {
            const { amount, reason } = req.body;
            const userId = req.user ? req.user.id : null;

            const payment = await paymentService.requestRefund({
                paymentId: req.params.id,
                amount,
                reason,
                userId,
            });

            return res.status(202).json({
                success: true,
                message: 'Refund request processed',
                data: payment,
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new PaymentController();
