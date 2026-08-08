const paymentRepository = require('../repositories/paymentRepository');
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');

async function reconcileStuckPayments() {
    try {
        const stuckPayments = await paymentRepository.findStuckPendingPayments();
        if (stuckPayments.length === 0) return;

        logger.info(`PaymentReconciler: Found ${stuckPayments.length} stuck pending payments. Checking status...`);

        for (const payment of stuckPayments) {
            // Reconcile: If stuck > 2 mins without callback, mark FAILED and release seats
            const ageMs = Date.now() - new Date(payment.created_at).getTime();
            if (ageMs > 2 * 60 * 1000) {
                logger.warn(`PaymentReconciler: Payment ${payment.id} for booking ${payment.booking_ref} timed out. Reconciling to FAILED.`);
                await paymentService.processWebhookCallback({
                    event_id: `reconcile_${payment.id}_${Date.now()}`,
                    payment_id: payment.gateway_payment_id || `pay_${payment.id}`,
                    booking_ref: payment.booking_ref,
                    status: 'FAILED',
                    reason: 'Payment timeout (reconciled by worker)',
                });
            }
        }
    } catch (err) {
        logger.error('Error running PaymentReconciler:', err.message);
    }
}

function startPaymentReconciler(intervalMs = 30000) {
    logger.info(`Payment Reconciler started (running every ${intervalMs}ms)...`);
    const interval = setInterval(async () => {
        await reconcileStuckPayments();
    }, intervalMs);

    return () => clearInterval(interval);
}

module.exports = {
    reconcileStuckPayments,
    startPaymentReconciler,
};
