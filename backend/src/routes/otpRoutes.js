const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

router.post('/otp/send', otpSendLimiter, (req, res, next) => otpController.sendOtp(req, res, next));
router.post('/otp/verify', otpVerifyLimiter, (req, res, next) => otpController.verifyOtp(req, res, next));

module.exports = router;
