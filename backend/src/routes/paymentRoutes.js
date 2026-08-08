const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuth } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

router.post('/payments', optionalAuth, paymentLimiter, (req, res, next) => paymentController.initiatePayment(req, res, next));
router.get('/payments/:id', optionalAuth, (req, res, next) => paymentController.getPaymentById(req, res, next));
router.post('/payments/:id/refund', optionalAuth, (req, res, next) => paymentController.requestRefund(req, res, next));

module.exports = router;
