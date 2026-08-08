const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, (req, res, next) => authController.signup(req, res, next));
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.get('/profile', authenticate, (req, res, next) => authController.getProfile(req, res, next));

module.exports = router;
