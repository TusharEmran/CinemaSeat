const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { holdLimiter } = require('../middleware/rateLimiter');

// Hold seats for a show
router.post('/shows/:showId/holds', optionalAuth, holdLimiter, (req, res, next) => bookingController.createHold(req, res, next));

// Bookings endpoints
router.get('/bookings/:id', optionalAuth, (req, res, next) => bookingController.getBookingById(req, res, next));
router.get('/users/:userId/bookings', optionalAuth, (req, res, next) => bookingController.getUserBookings(req, res, next));
router.post('/bookings/:id/cancel', optionalAuth, (req, res, next) => bookingController.cancelBooking(req, res, next));

module.exports = router;
