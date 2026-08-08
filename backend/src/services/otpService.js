const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const otpRepository = require('../repositories/otpRepository');
const gatewayClient = require('./gatewayClient');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError, TooManyRequestsError } = require('../utils/errors');

class OtpService {
    async sendOtp({ phone, referenceRef = null }, mockHeaders = {}) {
        const ref = referenceRef || `otp_${uuidv4().replace(/-/g, '').substring(0, 10)}`;
        const callbackUrl = `http://api:3000/webhooks/otp`;

        // Call External Gateway /otp/send
        const gatewayRes = await gatewayClient.sendOtp({ phone, ref, callbackUrl }, mockHeaders);

        // Generate dummy local code for verification matching (if gateway returned code, or simulate hash)
        const code = gatewayRes.data && gatewayRes.data.code ? String(gatewayRes.data.code) : '123456';
        const codeHash = await bcrypt.hash(code, 8);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiration

        const otpRecord = await otpRepository.create({
            phone,
            referenceRef: ref,
            codeHash,
            expiresAt,
        });

        logger.info(`OTP sent for phone ${phone}, ref: ${ref}`);
        return {
            reference_ref: ref,
            status: 'PENDING',
            message: 'OTP sent successfully',
            expires_at: expiresAt,
        };
    }

    async verifyOtp({ phone, referenceRef, code }, mockHeaders = {}) {
        const otpRecord = await otpRepository.findByReference(referenceRef);
        if (!otpRecord) {
            throw new NotFoundError('OTP reference not found or expired');
        }

        if (otpRecord.status === 'VERIFIED') {
            return { status: 'VERIFIED', message: 'OTP already verified' };
        }

        if (otpRecord.attempts >= 5) {
            await otpRepository.updateStatus(otpRecord.id, 'FAILED');
            throw new TooManyRequestsError('Maximum OTP verification attempts (5) exceeded');
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            await otpRepository.updateStatus(otpRecord.id, 'EXPIRED');
            throw new BadRequestError('OTP has expired');
        }

        // Call Gateway /otp/verify
        let gatewayResultStatus = 200;
        try {
            const res = await gatewayClient.verifyOtp({ phone, ref: referenceRef, code }, mockHeaders);
            gatewayResultStatus = res.status;
        } catch (err) {
            // Gateway might return 400 or 429
            await otpRepository.incrementAttempts(otpRecord.id);
            throw new BadRequestError('Invalid OTP code or verification failed at gateway');
        }

        if (gatewayResultStatus !== 200) {
            await otpRepository.incrementAttempts(otpRecord.id);
            throw new BadRequestError('Invalid OTP code');
        }

        // Verify hash locally
        const isMatch = await bcrypt.compare(code, otpRecord.code_hash);
        if (!isMatch) {
            await otpRepository.incrementAttempts(otpRecord.id);
            throw new BadRequestError('Invalid OTP code');
        }

        await otpRepository.updateStatus(otpRecord.id, 'VERIFIED');
        logger.info(`OTP verified successfully for ref ${referenceRef}`);

        return {
            reference_ref: referenceRef,
            status: 'VERIFIED',
            message: 'OTP verified successfully',
        };
    }

    async processOtpWebhook(payload) {
        const { ref, status, phone } = payload;
        if (!ref || !status) return;

        const otpRecord = await otpRepository.findByReference(ref);
        if (otpRecord && status === 'DELIVERED') {
            logger.info(`OTP delivery confirmed by gateway callback for ref ${ref}`);
        }
    }
}

module.exports = new OtpService();
