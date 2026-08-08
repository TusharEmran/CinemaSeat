const db = require('../config/db');

class OutboxRepository {
    async createEventTx(client, { eventType, aggregateType, aggregateId, payload }) {
        const res = await client.query(
            `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [eventType, aggregateType, aggregateId, JSON.stringify(payload)]
        );
        return res.rows[0];
    }

    async fetchPendingEvents(limit = 50) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const res = await client.query(
                `SELECT * FROM outbox_events 
                 WHERE status = 'PENDING' 
                 ORDER BY id ASC 
                 LIMIT $1 
                 FOR UPDATE SKIP LOCKED`,
                [limit]
            );
            await client.query('COMMIT');
            return res.rows;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async markPublished(id) {
        const res = await db.query(
            `UPDATE outbox_events 
             SET status = 'PUBLISHED', published_at = NOW() 
             WHERE id = $1 
             RETURNING *`,
            [id]
        );
        return res.rows[0];
    }

    async markFailed(id) {
        const res = await db.query(
            `UPDATE outbox_events 
             SET status = 'FAILED' 
             WHERE id = $1 
             RETURNING *`,
            [id]
        );
        return res.rows[0];
    }
}

module.exports = new OutboxRepository();
