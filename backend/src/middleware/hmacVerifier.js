const crypto = require('crypto');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

function verifyGatewayHmac(req, res, next) {
    const signature = req.headers['x-signature'];

    if (!signature) {
        logger.warn('Webhook request missing X-Signature header');
        return next(new UnauthorizedError('Missing X-Signature header'));
    }

    let rawBody;
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
        rawBody = req.rawBody.toString('utf8');
    } else if (typeof req.rawBody === 'string') {
        rawBody = req.rawBody;
    } else if (typeof req.body === 'string') {
        rawBody = req.body;
    } else {
        // Fallback: re-serialize json if rawBody was not captured
        rawBody = JSON.stringify(req.body);
    }

    const expectedSignature = crypto
        .createHmac('sha256', config.gateway.secret)
        .update(rawBody)
        .digest('hex');

    if (signature !== expectedSignature) {
        logger.warn(`HMAC verification failed. Received: ${signature}, Expected: ${expectedSignature}`);
        return next(new UnauthorizedError('Invalid HMAC signature'));
    }

    next();
}

module.exports = verifyGatewayHmac;
