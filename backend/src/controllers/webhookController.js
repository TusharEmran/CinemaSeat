const paymentService = require('../services/paymentService');
const otpService = require('../services/otpService');
const logger = require('../utils/logger');

class WebhookController {
    async handlePaymentWebhook(req, res, next) {
        try {
            logger.info('Received payment webhook payload:', req.body);
            const result = await paymentService.processWebhookCallback(req.body);

            // ALWAYS return 200 OK for valid webhook requests (including duplicates)
            // returning non-2xx causes gateway to retry unnecessarily
            return res.status(200).json({
                success: true,
                message: result.duplicate ? 'Duplicate callback ignored' : 'Webhook processed successfully',
            });
        } catch (err) {
            logger.error('Error handling payment webhook:', err.message);
            // In case of unexpected server error during webhook processing, pass to error handler or return 200 if necessary
            next(err);
        }
    }

    async handleOtpWebhook(req, res, next) {
        try {
            logger.info('Received OTP webhook payload:', req.body);
            await otpService.processOtpWebhook(req.body);
            return res.status(200).json({ success: true, message: 'OTP webhook received' });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new WebhookController();
