const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const config = require('../src/config');

describe('Payment Webhook Callback Idempotency', () => {
    let bookingRef;
    let bookingId;

    beforeAll(async () => {
        // Create a test booking
        const showRes = await pool.query('SELECT id FROM shows LIMIT 1');
        const showId = showRes.rows[0].id;
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;

        bookingRef = `bk_test_idempotency_${Date.now()}`;
        const bRes = await pool.query(
            `INSERT INTO bookings (booking_ref, user_id, show_id, total_amount, status)
             VALUES ($1, $2, $3, 450.00, 'PENDING') RETURNING id`,
            [bookingRef, userId, showId]
        );
        bookingId = bRes.rows[0].id;

        // Insert pending payment
        await pool.query(
            `INSERT INTO payments (booking_id, booking_ref, amount, currency, idempotency_key, status)
             VALUES ($1, $2, 450.00, 'BDT', $3, 'PENDING')`,
            [bookingId, bookingRef, `idemp_${Date.now()}`]
        );
    });

    test('Duplicate webhook callback with identical event_id returns 200 OK and processes state change only once', async () => {
        const eventId = `evt_dedup_${Date.now()}`;
        const payload = {
            event_id: eventId,
            payment_id: `pay_${Date.now()}`,
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

        // First callback
        const res1 = await request(app)
            .post('/webhooks/payment')
            .set('X-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(rawBody);

        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);

        // Verify booking status is CONFIRMED
        const bRes1 = await pool.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
        expect(bRes1.rows[0].status).toBe('CONFIRMED');

        // Second identical callback (Duplicate)
        const res2 = await request(app)
            .post('/webhooks/payment')
            .set('X-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(rawBody);

        expect(res2.status).toBe(200);
        expect(res2.body.success).toBe(true);

        // Verify payment_events table contains exactly 1 row for event_id
        const eventRes = await pool.query('SELECT COUNT(*) FROM payment_events WHERE event_id = $1', [eventId]);
        expect(parseInt(eventRes.rows[0].count, 10)).toBe(1);
    });
});
