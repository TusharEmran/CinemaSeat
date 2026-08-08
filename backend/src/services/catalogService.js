const movieRepository = require('../repositories/movieRepository');
const theatreRepository = require('../repositories/theatreRepository');
const showRepository = require('../repositories/showRepository');
const seatRepository = require('../repositories/seatRepository');
const { getRedisClient, isConnected } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class CatalogService {
    async _getFromCache(key) {
        if (!isConnected()) return null;
        try {
            const redis = await getRedisClient();
            const cached = await redis.get(key);
            if (cached) return JSON.parse(cached);
        } catch (err) {
            logger.warn(`Redis get cache error for ${key}:`, err.message);
        }
        return null;
    }

    async _setCache(key, value, ttlSeconds = config.redis.ttl) {
        if (!isConnected()) return;
        try {
            const redis = await getRedisClient();
            await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (err) {
            logger.warn(`Redis set cache error for ${key}:`, err.message);
        }
    }

    async _invalidateCache(pattern) {
        if (!isConnected()) return;
        try {
            const redis = await getRedisClient();
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(keys);
            }
        } catch (err) {
            logger.warn(`Redis cache invalidation error for ${pattern}:`, err.message);
        }
    }

    async getAllMovies() {
        const cacheKey = 'catalog:movies:all';
        const cached = await this._getFromCache(cacheKey);
        if (cached) return cached;

        const movies = await movieRepository.findAll();
        await this._setCache(cacheKey, movies);
        return movies;
    }

    async getMovieById(id) {
        const cacheKey = `catalog:movies:${id}`;
        const cached = await this._getFromCache(cacheKey);
        if (cached) return cached;

        const movie = await movieRepository.findById(id);
        if (!movie) {
            throw new NotFoundError('Movie not found');
        }
        await this._setCache(cacheKey, movie);
        return movie;
    }

    async createMovie(data) {
        const movie = await movieRepository.create(data);
        await this._invalidateCache('catalog:movies:*');
        return movie;
    }

    async updateMovie(id, updates) {
        const movie = await movieRepository.update(id, updates);
        if (!movie) throw new NotFoundError('Movie not found');
        await this._invalidateCache('catalog:movies:*');
        return movie;
    }

    async deleteMovie(id) {
        const success = await movieRepository.delete(id);
        if (!success) throw new NotFoundError('Movie not found');
        await this._invalidateCache('catalog:movies:*');
        return true;
    }

    async getAllTheatres() {
        const cacheKey = 'catalog:theatres:all';
        const cached = await this._getFromCache(cacheKey);
        if (cached) return cached;

        const theatres = await theatreRepository.findAll();
        await this._setCache(cacheKey, theatres);
        return theatres;
    }

    async getTheatreById(id) {
        const theatre = await theatreRepository.findById(id);
        if (!theatre) throw new NotFoundError('Theatre not found');
        return theatre;
    }

    async getScreensByTheatreId(theatreId) {
        await this.getTheatreById(theatreId); // ensure theatre exists
        return theatreRepository.findScreensByTheatreId(theatreId);
    }

    async getShows(filters) {
        return showRepository.findAll(filters);
    }

    async getShowById(id) {
        const show = await showRepository.findById(id);
        if (!show) throw new NotFoundError('Show not found');
        return show;
    }

    async getShowSeats(showId) {
        await this.getShowById(showId); // ensure show exists
        return seatRepository.findShowSeatsByShowId(showId);
    }
}

module.exports = new CatalogService();
