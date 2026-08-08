const db = require('../config/db');

class BookingRepository {
    async createTx(client, { bookingRef, userId, showId, totalAmount, status = 'PENDING' }) {
        const res = await client.query(
            `INSERT INTO bookings (booking_ref, user_id, show_id, total_amount, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [bookingRef, userId, showId, totalAmount, status]
        );
        return res.rows[0];
    }

    async addBookingSeatsTx(client, bookingSeats) {
        // bookingSeats is array of { bookingId, showSeatId, price }
        const values = [];
        const valueStrings = [];
        bookingSeats.forEach((item, idx) => {
            const base = idx * 3;
            valueStrings.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
            values.push(item.bookingId, item.showSeatId, item.price);
        });

        const query = `
            INSERT INTO booking_seats (booking_id, show_seat_id, price)
            VALUES ${valueStrings.join(', ')}
            RETURNING *;
        `;
        const res = await client.query(query, values);
        return res.rows;
    }

    async findById(idOrRef) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrRef);
        const condition = isUuid ? 'b.id = $1' : 'b.booking_ref = $1';

        const bookingRes = await db.query(
            `SELECT b.*, s.start_time, s.end_time, m.title as movie_title, 
                    t.name as theatre_name, sc.name as screen_name
             FROM bookings b
             JOIN shows s ON b.show_id = s.id
             JOIN movies m ON s.movie_id = m.id
             JOIN screens sc ON s.screen_id = sc.id
             JOIN theatres t ON sc.theatre_id = t.id
             WHERE ${condition}`,
            [idOrRef]
        );

        if (bookingRes.rows.length === 0) return null;

        const booking = bookingRes.rows[0];
        const seatsRes = await db.query(
            `SELECT bs.*, st.row_number, st.seat_number, st.type as seat_type
             FROM booking_seats bs
             JOIN show_seats ss ON bs.show_seat_id = ss.id
             JOIN seats st ON ss.seat_id = st.id
             WHERE bs.booking_id = $1`,
            [booking.id] // Always use the UUID for the joined table
        );
        booking.seats = seatsRes.rows;
        return booking;
    }

    async findByRef(bookingRef, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query('SELECT * FROM bookings WHERE booking_ref = $1', [bookingRef]);
        return res.rows[0] || null;
    }

    async findByUserId(userId) {
        const res = await db.query(
            `SELECT b.*, m.title as movie_title, s.start_time, t.name as theatre_name
             FROM bookings b
             JOIN shows s ON b.show_id = s.id
             JOIN movies m ON s.movie_id = m.id
             JOIN screens sc ON s.screen_id = sc.id
             JOIN theatres t ON sc.theatre_id = t.id
             WHERE b.user_id = $1
             ORDER BY b.created_at DESC`,
            [userId]
        );
        return res.rows;
    }

    async updateStatusTx(client, { bookingId, status }) {
        const res = await client.query(
            `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, bookingId]
        );
        return res.rows[0] || null;
    }

    async findBookingShowSeats(bookingId, client = null) {
        const queryRunner = client || db;
        const res = await queryRunner.query(
            `SELECT show_seat_id FROM booking_seats WHERE booking_id = $1`,
            [bookingId]
        );
        return res.rows.map(r => r.show_seat_id);
    }

    async findExpiredPendingBookings(client = null) {
        const queryRunner = client || db;
        // Pending bookings where show_seats holds are expired
        const query = `
            SELECT DISTINCT b.id, b.booking_ref, b.user_id, b.show_id
            FROM bookings b
            JOIN booking_seats bs ON b.id = bs.booking_id
            JOIN show_seats ss ON bs.show_seat_id = ss.id
            WHERE b.status = 'PENDING' 
              AND (ss.status = 'AVAILABLE' OR (ss.status = 'HELD' AND ss.hold_until < NOW()))
        `;
        const res = await queryRunner.query(query);
        return res.rows;
    }
}

module.exports = new BookingRepository();
