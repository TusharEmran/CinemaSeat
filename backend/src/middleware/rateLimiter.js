const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient, isConnected } = require('../config/redis');
const logger = require('../utils/logger');
const { TooManyRequestsError } = require('../utils/errors');

function createRateLimiter({ windowMs, max, prefix, keyGenerator }) {
    const options = {
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: keyGenerator || ((req) => req.ip),
        handler: (req, res, next) => {
            next(new TooManyRequestsError(`Rate limit exceeded for ${prefix}. Please try again later.`));
        },
    };

    if (isConnected()) {
        try {
            getRedisClient().then((redisClient) => {
                options.store = new RedisStore({
                    sendCommand: (...args) => redisClient.sendCommand(args),
                    prefix: `rl:${prefix}:`,
                });
            }).catch(() => {});
        } catch (err) {
            logger.warn(`Rate limiter Redis store setup error (${prefix}), using memory store:`, err.message);
        }
    }

    return rateLimit(options);
}

// Instantiate rate limiters ONCE at top level
const authLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    prefix: 'auth',
});

const otpSendLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    prefix: 'otp_send',
    keyGenerator: (req) => req.body.phone || req.ip,
});

const otpVerifyLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    prefix: 'otp_verify',
    keyGenerator: (req) => req.body.reference_ref || req.ip,
});

const holdLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    prefix: 'holds',
    keyGenerator: (req) => (req.user ? req.user.id : req.ip),
});

const paymentLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    prefix: 'payments',
    keyGenerator: (req) => (req.user ? req.user.id : req.ip),
});

const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    prefix: 'webhooks',
});

module.exports = {
    authLimiter,
    otpSendLimiter,
    otpVerifyLimiter,
    holdLimiter,
    paymentLimiter,
    webhookLimiter,
};
