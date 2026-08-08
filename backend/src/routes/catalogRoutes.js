const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');

// Movies
router.get('/movies', (req, res, next) => catalogController.getMovies(req, res, next));
router.get('/movies/:id', (req, res, next) => catalogController.getMovieById(req, res, next));
router.post('/movies', (req, res, next) => catalogController.createMovie(req, res, next));
router.patch('/movies/:id', (req, res, next) => catalogController.updateMovie(req, res, next));
router.delete('/movies/:id', (req, res, next) => catalogController.deleteMovie(req, res, next));

// Theatres & Screens
router.get('/theatres', (req, res, next) => catalogController.getTheatres(req, res, next));
router.get('/theatres/:id', (req, res, next) => catalogController.getTheatreById(req, res, next));
router.get('/theatres/:id/screens', (req, res, next) => catalogController.getScreensByTheatre(req, res, next));

// Shows & Seats
router.get('/shows', (req, res, next) => catalogController.getShows(req, res, next));
router.get('/shows/:id', (req, res, next) => catalogController.getShowById(req, res, next));
router.get('/shows/:showId/seats', (req, res, next) => catalogController.getShowSeats(req, res, next));

module.exports = router;
