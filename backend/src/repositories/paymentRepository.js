const db = require('../config/db');

class PaymentRepository {
    async findByIdempotencyKey(idempotencyKey, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query(
            'SELECT * FROM payments WHERE idempotency_key = $1',
            [idempotencyKey]
        );
        return res.rows[0] || null;
    }

    async findById(id, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query('SELECT * FROM payments WHERE id = $1', [id]);
        return res.rows[0] || null;
    }

    async findByBookingRef(bookingRef, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query(
            'SELECT * FROM payments WHERE booking_ref = $1 ORDER BY created_at DESC LIMIT 1',
            [bookingRef]
        );
        return res.rows[0] || null;
    }

    async createTx(client, { bookingId, bookingRef, amount, currency, idempotencyKey, gatewayPaymentId = null, status = 'PENDING' }) {
        const res = await client.query(
            `INSERT INTO payments (booking_id, booking_ref, amount, currency, idempotency_key, gateway_payment_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [bookingId, bookingRef, amount, currency || 'BDT', idempotencyKey, gatewayPaymentId, status]
        );
        return res.rows[0];
    }

    async updateGatewayPaymentId(id, gatewayPaymentId, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query(
            `UPDATE payments SET gateway_payment_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [gatewayPaymentId, id]
        );
        return res.rows[0] || null;
    }

    async updateStatusTx(client, { paymentId, status, reason = null, gatewayPaymentId = null }) {
        let query = `UPDATE payments SET status = $1, updated_at = NOW()`;
        const params = [status];

        if (reason) {
            params.push(reason);
            query += `, reason = $${params.length}`;
        }

        if (gatewayPaymentId) {
            params.push(gatewayPaymentId);
            query += `, gateway_payment_id = $${params.length}`;
        }

        params.push(paymentId);
        query += ` WHERE id = $${params.length} RETURNING *`;

        const res = await client.query(query, params);
        return res.rows[0] || null;
    }

    /**
     * Webhook event deduplication via payment_events table
     * Returns true if event was inserted (first time), false if conflict (already processed)
     */
    async recordPaymentEventTx(client, { eventId, paymentId, bookingRef, status, payload }) {
        const query = `
            INSERT INTO payment_events (event_id, payment_id, booking_ref, status, payload)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING id;
        `;
        const res = await client.query(query, [eventId, paymentId, bookingRef, status, JSON.stringify(payload)]);
        return res.rowCount > 0;
    }

    async findStuckPendingPayments() {
        // Payments created > 30 seconds ago still PENDING
        const res = await db.query(
            `SELECT * FROM payments WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '30 seconds'`
        );
        return res.rows;
    }
}

module.exports = new PaymentRepository();
