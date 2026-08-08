const db = require('../config/db');

class OtpRepository {
    async create({ phone, referenceRef, codeHash, expiresAt }) {
        const res = await db.query(
            `INSERT INTO otp_verifications (phone, reference_ref, code_hash, status, expires_at)
             VALUES ($1, $2, $3, 'PENDING', $4)
             RETURNING *`,
            [phone, referenceRef, codeHash, expiresAt]
        );
        return res.rows[0];
    }

    async findByReference(referenceRef) {
        const res = await db.query(
            'SELECT * FROM otp_verifications WHERE reference_ref = $1 ORDER BY created_at DESC LIMIT 1',
            [referenceRef]
        );
        return res.rows[0] || null;
    }

    async incrementAttempts(id) {
        const res = await db.query(
            `UPDATE otp_verifications SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return res.rows[0];
    }

    async updateStatus(id, status) {
        const res = await db.query(
            `UPDATE otp_verifications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return res.rows[0];
    }
}

module.exports = new OtpRepository();
