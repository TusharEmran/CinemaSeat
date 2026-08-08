const config = require('../config');
const logger = require('../utils/logger');
const { GatewayError, ServiceUnavailableError } = require('../utils/errors');

class CircuitBreaker {
    constructor({ failureThreshold = 5, cooldownMs = 10000 }) {
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.nextAttemptTime = 0;
    }

    canExecute() {
        if (this.state === 'CLOSED') return true;

        if (this.state === 'OPEN') {
            if (Date.now() >= this.nextAttemptTime) {
                this.state = 'HALF_OPEN';
                logger.warn('Circuit Breaker transitioning to HALF_OPEN to test Gateway availability.');
                return true;
            }
            return false;
        }

        if (this.state === 'HALF_OPEN') {
            return true;
        }

        return false;
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            logger.info('Gateway recovered. Circuit Breaker reset to CLOSED.');
        }
    }

    onFailure(error) {
        this.failureCount += 1;
        logger.warn(`Gateway call failed (${this.failureCount}/${this.failureThreshold}):`, error.message);

        if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.cooldownMs;
            logger.error(`Circuit Breaker OPENED! Gateway calls blocked for ${this.cooldownMs}ms.`);
        }
    }
}

class GatewayClient {
    constructor() {
        this.baseUrl = config.gateway.url;
        this.secret = config.gateway.secret;
        this.timeoutMs = config.gateway.timeoutMs;
        this.circuitBreaker = new CircuitBreaker({});
    }

    async _request(endpoint, method, data = null, customHeaders = {}) {
        if (!this.circuitBreaker.canExecute()) {
            throw new ServiceUnavailableError('Payment gateway circuit breaker is OPEN. Try again later.');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders,
        };

        const options = {
            method,
            headers,
            signal: controller.signal,
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            clearTimeout(timeout);

            let resBody = {};
            const text = await response.text();
            if (text) {
                try {
                    resBody = JSON.parse(text);
                } catch (e) {
                    resBody = { message: text };
                }
            }

            if (response.ok || response.status === 202) {
                this.circuitBreaker.onSuccess();
                return { status: response.status, data: resBody };
            }

            // Client errors (4xx) don't trip the circuit breaker, server errors (5xx) do
            if (response.status >= 500) {
                const err = new GatewayError(`Gateway server error HTTP ${response.status}: ${resBody.message || 'Unknown'}`);
                this.circuitBreaker.onFailure(err);
                throw err;
            }

            return { status: response.status, data: resBody };
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') {
                const timeoutErr = new GatewayError(`Gateway request timed out after ${this.timeoutMs}ms`);
                this.circuitBreaker.onFailure(timeoutErr);
                throw timeoutErr;
            }

            if (err instanceof ServiceUnavailableError || err instanceof GatewayError) {
                throw err;
            }

            const networkErr = new GatewayError(`Network error communicating with Gateway: ${err.message}`);
            this.circuitBreaker.onFailure(networkErr);
            throw networkErr;
        }
    }

    async charge({ amount, currency = 'BDT', bookingRef, callbackUrl, idempotencyKey }, mockHeaders = {}) {
        const headers = {
            'Idempotency-Key': idempotencyKey,
            ...mockHeaders,
        };
        return this._request('/charge', 'POST', {
            amount,
            currency,
            booking_ref: bookingRef,
            callback_url: callbackUrl,
        }, headers);
    }

    async refund({ paymentId, amount, reason }, mockHeaders = {}) {
        return this._request('/refund', 'POST', {
            payment_id: paymentId,
            amount,
            reason,
        }, mockHeaders);
    }

    async sendOtp({ phone, ref, callbackUrl }, mockHeaders = {}) {
        return this._request('/otp/send', 'POST', {
            phone,
            ref,
            callback_url: callbackUrl,
        }, mockHeaders);
    }

    async verifyOtp({ phone, ref, code }, mockHeaders = {}) {
        return this._request('/otp/verify', 'POST', {
            phone,
            ref,
            code,
        }, mockHeaders);
    }

    async checkHealth() {
        return this._request('/health', 'GET');
    }
}

module.exports = new GatewayClient();
