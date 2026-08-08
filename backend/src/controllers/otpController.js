const otpService = require('../services/otpService');
const { BadRequestError } = require('../utils/errors');

class OtpController {
    async sendOtp(req, res, next) {
        try {
            const { phone, reference_ref } = req.body;
            if (!phone) {
                throw new BadRequestError('phone number is required');
            }

            const mockHeaders = {};
            if (req.headers['x-mock-mode']) mockHeaders['X-Mock-Mode'] = req.headers['x-mock-mode'];
            if (req.headers['x-mock-force']) mockHeaders['X-Mock-Force'] = req.headers['x-mock-force'];

            const result = await otpService.sendOtp({ phone, referenceRef: reference_ref }, mockHeaders);
            return res.status(200).json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    async verifyOtp(req, res, next) {
        try {
            const { phone, reference_ref, code } = req.body;
            if (!phone || !reference_ref || !code) {
                throw new BadRequestError('phone, reference_ref, and code are required');
            }

            const mockHeaders = {};
            if (req.headers['x-mock-mode']) mockHeaders['X-Mock-Mode'] = req.headers['x-mock-mode'];
            if (req.headers['x-mock-force']) mockHeaders['X-Mock-Force'] = req.headers['x-mock-force'];

            const result = await otpService.verifyOtp({ phone, referenceRef: reference_ref, code }, mockHeaders);
            return res.status(200).json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new OtpController();
