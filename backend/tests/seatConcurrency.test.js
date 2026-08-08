const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

describe('Seat Hold Concurrency & Race Condition Safeguard', () => {
    let showId;
    let seatId;

    beforeAll(async () => {
        // Fetch an available show and seat from seed data
        const showRes = await pool.query('SELECT id FROM shows LIMIT 1');
        showId = showRes.rows[0].id;

        const seatRes = await pool.query('SELECT seat_id FROM show_seats WHERE show_id = $1 AND status = \'AVAILABLE\' LIMIT 1', [showId]);
        seatId = seatRes.rows[0].seat_id;
    });

    test('Concurrent hold requests for the same seat results in exactly ONE success and all others rejected with 409 Conflict', async () => {
        const concurrentUsers = 5;
        const requests = [];

        for (let i = 0; i < concurrentUsers; i++) {
            requests.push(
                request(app)
                    .post(`/api/shows/${showId}/holds`)
                    .send({ seat_ids: [seatId] })
            );
        }

        const responses = await Promise.all(requests);

        const successes = responses.filter(r => r.status === 201);
        const conflicts = responses.filter(r => r.status === 409);

        expect(successes.length).toBe(1);
        expect(conflicts.length).toBe(concurrentUsers - 1);

        // Verify database state: seat is HELD
        const dbRes = await pool.query('SELECT status FROM show_seats WHERE show_id = $1 AND seat_id = $2', [showId, seatId]);
        expect(dbRes.rows[0].status).toBe('HELD');
    });
});
