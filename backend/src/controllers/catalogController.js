const catalogService = require('../services/catalogService');

class CatalogController {
    async getMovies(req, res, next) {
        try {
            const movies = await catalogService.getAllMovies();
            return res.status(200).json({ success: true, data: movies });
        } catch (err) {
            next(err);
        }
    }

    async getMovieById(req, res, next) {
        try {
            const movie = await catalogService.getMovieById(req.params.id);
            return res.status(200).json({ success: true, data: movie });
        } catch (err) {
            next(err);
        }
    }

    async createMovie(req, res, next) {
        try {
            const movie = await catalogService.createMovie(req.body);
            return res.status(201).json({ success: true, data: movie });
        } catch (err) {
            next(err);
        }
    }

    async updateMovie(req, res, next) {
        try {
            const movie = await catalogService.updateMovie(req.params.id, req.body);
            return res.status(200).json({ success: true, data: movie });
        } catch (err) {
            next(err);
        }
    }

    async deleteMovie(req, res, next) {
        try {
            await catalogService.deleteMovie(req.params.id);
            return res.status(200).json({ success: true, message: 'Movie deleted successfully' });
        } catch (err) {
            next(err);
        }
    }

    async getTheatres(req, res, next) {
        try {
            const theatres = await catalogService.getAllTheatres();
            return res.status(200).json({ success: true, data: theatres });
        } catch (err) {
            next(err);
        }
    }

    async getTheatreById(req, res, next) {
        try {
            const theatre = await catalogService.getTheatreById(req.params.id);
            return res.status(200).json({ success: true, data: theatre });
        } catch (err) {
            next(err);
        }
    }

    async getScreensByTheatre(req, res, next) {
        try {
            const screens = await catalogService.getScreensByTheatreId(req.params.id);
            return res.status(200).json({ success: true, data: screens });
        } catch (err) {
            next(err);
        }
    }

    async getShows(req, res, next) {
        try {
            const { movie_id, theatre_id, date } = req.query;
            const shows = await catalogService.getShows({ movieId: movie_id, theatreId: theatre_id, date });
            return res.status(200).json({ success: true, data: shows });
        } catch (err) {
            next(err);
        }
    }

    async getShowById(req, res, next) {
        try {
            const show = await catalogService.getShowById(req.params.id);
            return res.status(200).json({ success: true, data: show });
        } catch (err) {
            next(err);
        }
    }

    async getShowSeats(req, res, next) {
        try {
            const seats = await catalogService.getShowSeats(req.params.showId);
            return res.status(200).json({ success: true, data: seats });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CatalogController();
