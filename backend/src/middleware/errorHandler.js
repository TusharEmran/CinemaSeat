const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        logger.warn(`AppError [${err.errorCode}]: ${err.message}`);
        const response = {
            success: false,
            error: {
                code: err.errorCode,
                message: err.message,
            },
        };
        if (err.errors) {
            response.error.details = err.errors;
        }
        return res.status(err.statusCode).json(response);
    }

    logger.error('Unhandled System Error:', err);
    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected internal error occurred.',
        },
    });
}

module.exports = errorHandler;
