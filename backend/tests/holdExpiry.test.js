const { pool } = require('../src/config/db');
const bookingService = require('../src/services/bookingService');

describe('Seat Hold Expiration & Sweeper', () => {
    let showId;
    let seatId;

    beforeAll(async () => {
        const showRes = await pool.query('SELECT id FROM shows LIMIT 1');
        showId = showRes.rows[0].id;
        const seatRes = await pool.query('SELECT seat_id FROM show_seats WHERE show_id = $1 LIMIT 1', [showId]);
        seatId = seatRes.rows[0].seat_id;
    });

    test('Stale hold with hold_until in the past is automatically expired and seat reverts to AVAILABLE', async () => {
        // Manually set seat status to HELD with hold_until in the past
        await pool.query(
            `UPDATE show_seats SET status = 'HELD', hold_until = NOW() - INTERVAL '5 minutes' WHERE show_id = $1 AND seat_id = $2`,
            [showId, seatId]
        );

        // Run hold sweeper
        const result = await bookingService.expireStaleHoldsAndBookings();
        expect(result.expiredSeatsCount).toBeGreaterThanOrEqual(1);

        // Verify seat is AVAILABLE
        const seatRes = await pool.query('SELECT status FROM show_seats WHERE show_id = $1 AND seat_id = $2', [showId, seatId]);
        expect(seatRes.rows[0].status).toBe('AVAILABLE');
    });
});
