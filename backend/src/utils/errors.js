class AppError extends Error {
    constructor(message, statusCode, errorCode = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad Request', errorCode = 'BAD_REQUEST') {
        super(message, 400, errorCode);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', errorCode = 'UNAUTHORIZED') {
        super(message, 401, errorCode);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', errorCode = 'FORBIDDEN') {
        super(message, 403, errorCode);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found', errorCode = 'NOT_FOUND') {
        super(message, 404, errorCode);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflict', errorCode = 'CONFLICT') {
        super(message, 409, errorCode);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR', errors = []) {
        super(message, 422, errorCode);
        this.errors = errors;
    }
}

class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests, please try again later', errorCode = 'TOO_MANY_REQUESTS') {
        super(message, 429, errorCode);
    }
}

class GatewayError extends AppError {
    constructor(message = 'Payment Gateway Error', errorCode = 'GATEWAY_ERROR') {
        super(message, 502, errorCode);
    }
}

class ServiceUnavailableError extends AppError {
    constructor(message = 'Service Unavailable', errorCode = 'SERVICE_UNAVAILABLE') {
        super(message, 503, errorCode);
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    TooManyRequestsError,
    GatewayError,
    ServiceUnavailableError,
};
