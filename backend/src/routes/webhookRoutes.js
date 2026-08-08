const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const verifyGatewayHmac = require('../middleware/hmacVerifier');
const { webhookLimiter } = require('../middleware/rateLimiter');

router.post('/webhooks/payment', webhookLimiter, verifyGatewayHmac, (req, res, next) => webhookController.handlePaymentWebhook(req, res, next));
router.post('/webhooks/otp', webhookLimiter, (req, res, next) => webhookController.handleOtpWebhook(req, res, next));

module.exports = router;
