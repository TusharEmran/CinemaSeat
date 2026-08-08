const db = require('../config/db');

class ShowRepository {
    async findAll({ movieId, theatreId, date } = {}) {
        let query = `
            SELECT s.*, 
                   m.title as movie_title, m.poster_url as movie_poster,
                   sc.name as screen_name, t.name as theatre_name, t.id as theatre_id
            FROM shows s
            JOIN movies m ON s.movie_id = m.id
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE 1=1
        `;
        const params = [];

        if (movieId) {
            params.push(movieId);
            query += ` AND s.movie_id = $${params.length}`;
        }

        if (theatreId) {
            params.push(theatreId);
            query += ` AND sc.theatre_id = $${params.length}`;
        }

        if (date) {
            params.push(date);
            query += ` AND DATE(s.start_time) = $${params.length}`;
        }

        query += ` ORDER BY s.start_time ASC`;

        const res = await db.query(query, params);
        return res.rows;
    }

    async findById(id) {
        const query = `
            SELECT s.*, 
                   m.title as movie_title, m.duration_minutes, m.rating,
                   sc.name as screen_name, t.name as theatre_name, t.location as theatre_location
            FROM shows s
            JOIN movies m ON s.movie_id = m.id
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE s.id = $1
        `;
        const res = await db.query(query, [id]);
        return res.rows[0] || null;
    }
}

module.exports = new ShowRepository();
