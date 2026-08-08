const db = require('../config/db');

class TheatreRepository {
    async findAll() {
        const res = await db.query('SELECT * FROM theatres ORDER BY name ASC');
        return res.rows;
    }

    async findById(id) {
        const res = await db.query('SELECT * FROM theatres WHERE id = $1', [id]);
        return res.rows[0] || null;
    }

    async findScreensByTheatreId(theatreId) {
        const res = await db.query('SELECT * FROM screens WHERE theatre_id = $1 ORDER BY name ASC', [theatreId]);
        return res.rows;
    }
}

module.exports = new TheatreRepository();
