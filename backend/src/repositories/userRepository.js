const db = require('../config/db');

class UserRepository {
    async findById(id) {
        const res = await db.query('SELECT id, name, email, phone, created_at FROM users WHERE id = $1', [id]);
        return res.rows[0] || null;
    }

    async findByEmail(email) {
        const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        return res.rows[0] || null;
    }

    async findByPhone(phone) {
        const res = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        return res.rows[0] || null;
    }

    async create({ name, email, phone, passwordHash }) {
        const res = await db.query(
            `INSERT INTO users (name, email, phone, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, phone, created_at`,
            [name, email, phone, passwordHash]
        );
        return res.rows[0];
    }
}

module.exports = new UserRepository();
