const { getRabbitMQChannel } = require('../config/rabbitmq');
const config = require('../config');
const notificationRepository = require('../repositories/notificationRepository');
const logger = require('../utils/logger');

async function startNotificationConsumer() {
    try {
        const channel = await getRabbitMQChannel();
        const queue = config.rabbitmq.queues.notifications;

        logger.info(`Starting Notification Consumer on queue: ${queue}`);
        await channel.prefetch(5);

        channel.consume(queue, async (msg) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());
                const eventId = content.event_id || `evt_${Date.now()}`;
                const eventType = content.event_type;
                const payload = content.payload || {};

                // Per-Consumer Idempotency Check via processed_events table
                const isFirstTime = await notificationRepository.isEventProcessed('notification_consumer', eventId);
                if (!isFirstTime) {
                    logger.info(`NotificationConsumer: Event ${eventId} already processed. Acknowledging & skipping.`);
                    channel.ack(msg);
                    return;
                }

                logger.info(`NotificationConsumer: Processing event ${eventType} (ID: ${eventId})`);

                let recipient = payload.user_ref || payload.user_id || 'user@example.com';
                let notificationContent = '';
                let notificationType = 'EMAIL';

                if (eventType === 'BookingConfirmed' || eventType === 'PaymentSucceeded') {
                    notificationContent = `Your booking ${payload.booking_ref || payload.booking_id} has been CONFIRMED! QR Code: ${payload.qr_payload || 'CS-PASS'}`;
                } else if (eventType === 'PaymentFailed') {
                    notificationContent = `Payment failed for booking ${payload.booking_ref}. Reason: ${payload.reason || 'Transaction declined'}.`;
                } else if (eventType === 'BookingCreated') {
                    notificationContent = `Seats held for booking ${payload.booking_ref}. Complete payment before hold expires.`;
                } else {
                    notificationContent = `Notification update for event ${eventType}`;
                }

                // Create notification record
                const notification = await notificationRepository.createNotification({
                    bookingId: payload.booking_id || null,
                    userRef: recipient,
                    type: notificationType,
                    recipient,
                    content: notificationContent,
                    status: 'SENT',
                });

                // Record delivery attempt
                await notificationRepository.recordDeliveryAttempt({
                    notificationId: notification.id,
                    attempt: 1,
                    status: 'DELIVERED',
                    response: 'SMS/Email gateway simulated dispatch success',
                });

                channel.ack(msg);
                logger.info(`NotificationConsumer: Notification sent successfully for event ${eventId}`);
            } catch (err) {
                logger.error('NotificationConsumer error processing message:', err.message);
                // Reject message to DLQ if retry exhausted
                channel.reject(msg, false);
            }
        });
    } catch (err) {
        logger.error('Failed to start NotificationConsumer:', err.message);
    }
}

module.exports = startNotificationConsumer;
