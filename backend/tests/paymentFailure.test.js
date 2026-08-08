const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const config = require('../src/config');

describe('Payment Failure Webhook Flow', () => {
    let bookingRef;
    let bookingId;
    let showSeatId;

    beforeAll(async () => {
        const showRes = await pool.query('SELECT id FROM shows LIMIT 1');
        const showId = showRes.rows[0].id;
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;
        const seatRes = await pool.query('SELECT id FROM show_seats WHERE show_id = $1 LIMIT 1', [showId]);
        showSeatId = seatRes.rows[0].id;

        // Set seat to HELD
        await pool.query('UPDATE show_seats SET status = \'HELD\' WHERE id = $1', [showSeatId]);

        bookingRef = `bk_test_fail_${Date.now()}`;
        const bRes = await pool.query(
            `INSERT INTO bookings (booking_ref, user_id, show_id, total_amount, status)
             VALUES ($1, $2, $3, 450.00, 'PENDING') RETURNING id`,
            [bookingRef, userId, showId]
        );
        bookingId = bRes.rows[0].id;

        await pool.query(
            `INSERT INTO booking_seats (booking_id, show_seat_id, price) VALUES ($1, $2, 450.00)`,
            [bookingId, showSeatId]
        );

        await pool.query(
            `INSERT INTO payments (booking_id, booking_ref, amount, currency, idempotency_key, status)
             VALUES ($1, $2, 450.00, 'BDT', $3, 'PENDING')`,
            [bookingId, bookingRef, `idemp_fail_${Date.now()}`]
        );
    });

    test('Gateway FAILED callback updates Payment -> FAILED, Booking -> CANCELLED, and releases ShowSeat -> AVAILABLE', async () => {
        const eventId = `evt_fail_${Date.now()}`;
        const payload = {
            event_id: eventId,
            payment_id: `pay_failed_${Date.now()}`,
            booking_ref: bookingRef,
            status: 'FAILED',
            reason: 'Insufficient funds',
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

        // Verify Payment status is FAILED
        const pRes = await pool.query('SELECT status, reason FROM payments WHERE booking_ref = $1', [bookingRef]);
        expect(pRes.rows[0].status).toBe('FAILED');
        expect(pRes.rows[0].reason).toBe('Insufficient funds');

        // Verify Booking status is CANCELLED
        const bRes = await pool.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
        expect(bRes.rows[0].status).toBe('CANCELLED');

        // Verify ShowSeat is AVAILABLE
        const sRes = await pool.query('SELECT status FROM show_seats WHERE id = $1', [showSeatId]);
        expect(sRes.rows[0].status).toBe('AVAILABLE');
    });
});
