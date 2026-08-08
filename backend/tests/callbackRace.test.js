const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const config = require('../src/config');

describe('Webhook Callback Arriving Before /charge Response Race Condition', () => {
    let bookingRef;
    let bookingId;

    beforeAll(async () => {
        const showRes = await pool.query('SELECT id FROM shows LIMIT 1');
        const showId = showRes.rows[0].id;
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;

        bookingRef = `bk_test_race_${Date.now()}`;
        const bRes = await pool.query(
            `INSERT INTO bookings (booking_ref, user_id, show_id, total_amount, status)
             VALUES ($1, $2, $3, 450.00, 'PENDING') RETURNING id`,
            [bookingRef, userId, showId]
        );
        bookingId = bRes.rows[0].id;

        // Save local payment record in PENDING state (pre-persisted)
        await pool.query(
            `INSERT INTO payments (booking_id, booking_ref, amount, currency, idempotency_key, status)
             VALUES ($1, $2, 450.00, 'BDT', $3, 'PENDING')`,
            [bookingId, bookingRef, `idemp_race_${Date.now()}`]
        );
    });

    test('Webhook processes successfully even if gateway_payment_id is not yet set on local payment record', async () => {
        const eventId = `evt_race_${Date.now()}`;
        const payload = {
            event_id: eventId,
            payment_id: 'pay_gateway_race_123',
            booking_ref: bookingRef,
            status: 'SUCCEEDED',
            amount: 450,
            currency: 'BDT',
        };

        const rawBody = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', config.gateway.secret)
            .update(rawBody)
            .digest('hex');

        const res = await request(app)
            .post('/webhooks/payment')
            .set('X-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(rawBody);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify payment record was updated to SUCCEEDED and gateway_payment_id filled in
        const pRes = await pool.query('SELECT status, gateway_payment_id FROM payments WHERE booking_ref = $1', [bookingRef]);
        expect(pRes.rows[0].status).toBe('SUCCEEDED');
        expect(pRes.rows[0].gateway_payment_id).toBe('pay_gateway_race_123');
    });
});
