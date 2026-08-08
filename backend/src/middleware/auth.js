const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Missing or invalid Authorization header'));
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded; // Contains id, email, phone
        next();
    } catch (err) {
        return next(new UnauthorizedError('Invalid or expired token'));
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            req.user = decoded;
        } catch (err) {
            // Ignore invalid token for optional auth
        }
    }
    next();
}

module.exports = {
    authenticate,
    optionalAuth,
};
