const db = require('../config/db');

class NotificationRepository {
    /**
     * Consumer idempotency check
     * Returns true if event was inserted (first time), false if conflict (already processed)
     */
    async isEventProcessed(consumerName, eventId) {
        const res = await db.query(
            `INSERT INTO processed_events (consumer_name, event_id)
             VALUES ($1, $2)
             ON CONFLICT (consumer_name, event_id) DO NOTHING
             RETURNING consumer_name`,
            [consumerName, eventId]
        );
        return res.rowCount > 0;
    }

    async createNotification({ bookingId, userRef, type, recipient, content, status = 'PENDING' }) {
        const res = await db.query(
            `INSERT INTO notifications (booking_id, user_ref, type, recipient, content, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [bookingId, userRef, type, recipient, content, status]
        );
        return res.rows[0];
    }

    async recordDeliveryAttempt({ notificationId, attempt, status, response }) {
        const res = await db.query(
            `INSERT INTO notification_deliveries (notification_id, attempt, status, response)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [notificationId, attempt, status, response]
        );
        return res.rows[0];
    }

    async updateNotificationStatus(id, status) {
        const res = await db.query(
            `UPDATE notifications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return res.rows[0];
    }
}

module.exports = new NotificationRepository();
