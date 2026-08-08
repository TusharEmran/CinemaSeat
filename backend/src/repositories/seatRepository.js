const db = require('../config/db');

class SeatRepository {
    async findShowSeatsByShowId(showId, client = null) {
        const queryRunner = client || db;
        const query = `
            SELECT ss.*, st.row_number, st.seat_number, st.type as seat_type,
                   CASE 
                       WHEN ss.status = 'HELD' AND ss.hold_until < NOW() THEN 'AVAILABLE'
                       ELSE ss.status
                   END as effective_status
            FROM show_seats ss
            JOIN seats st ON ss.seat_id = st.id
            WHERE ss.show_id = $1
            ORDER BY st.row_number ASC, st.seat_number ASC
        `;
        const res = await queryRunner.query(query, [showId]);
        return res.rows;
    }

    async findShowSeatsByIds(showSeatIds, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query(
            `SELECT ss.*, st.row_number, st.seat_number
             FROM show_seats ss
             JOIN seats st ON ss.seat_id = st.id
             WHERE ss.id = ANY($1::uuid[])`,
            [showSeatIds]
        );
        return res.rows;
    }

    /**
     * ATOMIC SEAT HOLD EXECUTION INSIDE POSTGRES TRANSACTION
     * Updates show_seats from AVAILABLE or EXPIRED HELD -> HELD for requested seat_ids
     */
    async holdSeatsTx(client, { showId, seatIds, holdMinutes }) {
        const query = `
            UPDATE show_seats
            SET status = 'HELD',
                hold_until = NOW() + ($1 || ' minutes')::INTERVAL,
                updated_at = NOW()
            WHERE show_id = $2
              AND seat_id = ANY($3::uuid[])
              AND (status = 'AVAILABLE' OR (status = 'HELD' AND hold_until < NOW()))
            RETURNING id, show_id, seat_id, status, hold_until, price;
        `;
        const res = await client.query(query, [holdMinutes.toString(), showId, seatIds]);
        return res.rows;
    }

    /**
     * Transition show_seats status (e.g. HELD -> BOOKED, or HELD/BOOKED -> AVAILABLE)
     */
    async updateSeatsStatusTx(client, { showSeatIds, newStatus, holdUntil = null }) {
        const query = `
            UPDATE show_seats
            SET status = $1,
                hold_until = $2,
                updated_at = NOW()
            WHERE id = ANY($3::uuid[])
            RETURNING id, status, hold_until;
        `;
        const res = await client.query(query, [newStatus, holdUntil, showSeatIds]);
        return res.rows;
    }

    /**
     * Expire stale HELD seats in bulk where hold_until < NOW()
     */
    async expireStaleHolds(client = null) {
        const queryRunner = client || db;
        const query = `
            UPDATE show_seats
            SET status = 'AVAILABLE',
                hold_until = NULL,
                updated_at = NOW()
            WHERE status = 'HELD' AND hold_until < NOW()
            RETURNING id, show_id;
        `;
        const res = await queryRunner.query(query);
        return res.rows;
    }
}

module.exports = new SeatRepository();
