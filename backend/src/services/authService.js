const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');

class AuthService {
    async signup({ name, email, phone, password }) {
        const existingEmail = await userRepository.findByEmail(email);
        if (existingEmail) {
            throw new ConflictError('User with this email already exists');
        }

        const existingPhone = await userRepository.findByPhone(phone);
        if (existingPhone) {
            throw new ConflictError('User with this phone number already exists');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await userRepository.create({ name, email, phone, passwordHash });

        const token = jwt.sign(
            { id: user.id, email: user.email, phone: user.phone },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        return { user, token };
    }

    async login({ email, password }) {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, phone: user.phone },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        delete user.password_hash;
        return { user, token };
    }

    async getUserProfile(userId) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    }
}

module.exports = new AuthService();
