const { getRabbitMQChannel } = require('../config/rabbitmq');
const config = require('../config');
const notificationRepository = require('../repositories/notificationRepository');
const logger = require('../utils/logger');

async function startAnalyticsConsumer() {
    try {
        const channel = await getRabbitMQChannel();
        const queue = config.rabbitmq.queues.analytics;

        logger.info(`Starting Analytics Consumer on queue: ${queue}`);
        await channel.prefetch(10);

        channel.consume(queue, async (msg) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());
                const eventId = content.event_id || `evt_${Date.now()}`;
                const eventType = content.event_type;

                // Consumer Idempotency check with consumer_name = 'analytics_consumer'
                const isFirstTime = await notificationRepository.isEventProcessed('analytics_consumer', eventId);
                if (!isFirstTime) {
                    channel.ack(msg);
                    return;
                }

                logger.info(`AnalyticsConsumer [METRIC]: Tracked event ${eventType} (ID: ${eventId}) | Aggregate: ${content.aggregate_type}:${content.aggregate_id}`);
                channel.ack(msg);
            } catch (err) {
                logger.error('AnalyticsConsumer error:', err.message);
                channel.reject(msg, false);
            }
        });
    } catch (err) {
        logger.error('Failed to start AnalyticsConsumer:', err.message);
    }
}

module.exports = startAnalyticsConsumer;
