const authService = require('../services/authService');

class AuthController {
    async signup(req, res, next) {
        try {
            const { name, email, phone, password } = req.body;
            if (!name || !email || !phone || !password) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Name, email, phone, and password are required' } });
            }
            const result = await authService.signup({ name, email, phone, password });
            return res.status(201).json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email and password are required' } });
            }
            const result = await authService.login({ email, password });
            return res.status(200).json({ success: true, data: result });
        } catch (err) {
            next(err);
        }
    }

    async getProfile(req, res, next) {
        try {
            const user = await authService.getUserProfile(req.user.id);
            return res.status(200).json({ success: true, data: user });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new AuthController();
