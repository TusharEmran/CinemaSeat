const db = require('../config/db');

class MovieRepository {
    async findAll() {
        const res = await db.query('SELECT * FROM movies ORDER BY release_date DESC');
        return res.rows;
    }

    async findById(id) {
        const res = await db.query('SELECT * FROM movies WHERE id = $1', [id]);
        return res.rows[0] || null;
    }

    async create({ title, description, durationMinutes, genre, rating, posterUrl, releaseDate }) {
        const res = await db.query(
            `INSERT INTO movies (title, description, duration_minutes, genre, rating, poster_url, release_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [title, description, durationMinutes, genre, rating || 'PG-13', posterUrl, releaseDate]
        );
        return res.rows[0];
    }

    async update(id, updates) {
        const keys = Object.keys(updates);
        if (keys.length === 0) return this.findById(id);

        const setClause = keys.map((key, idx) => `${key} = $${idx + 2}`).join(', ');
        const values = Object.values(updates);

        const res = await db.query(
            `UPDATE movies SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return res.rows[0] || null;
    }

    async delete(id) {
        const res = await db.query('DELETE FROM movies WHERE id = $1 RETURNING id', [id]);
        return res.rowCount > 0;
    }
}

module.exports = new MovieRepository();
