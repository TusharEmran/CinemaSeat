const outboxRepository = require('../repositories/outboxRepository');
const { getRabbitMQChannel } = require('../config/rabbitmq');
const config = require('../config');
const logger = require('../utils/logger');

async function processOutboxEvents() {
    let events = [];
    try {
        events = await outboxRepository.fetchPendingEvents(50);
    } catch (err) {
        logger.error('Error fetching outbox events:', err.message);
        return;
    }

    if (events.length === 0) return;

    let channel;
    try {
        channel = await getRabbitMQChannel();
    } catch (err) {
        logger.warn('RabbitMQ unavailable. Outbox events remain PENDING:', err.message);
        return;
    }

    for (const event of events) {
        try {
            const message = {
                event_id: String(event.id),
                event_type: event.event_type,
                aggregate_type: event.aggregate_type,
                aggregate_id: event.aggregate_id,
                occurred_at: event.created_at,
                payload: event.payload,
            };

            const published = channel.publish(
                config.rabbitmq.exchange,
                event.event_type,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            if (published) {
                await outboxRepository.markPublished(event.id);
                logger.info(`Outbox Publisher: Published event ${event.id} [${event.event_type}] to RabbitMQ`);
            } else {
                logger.warn(`Outbox Publisher: Failed to publish event ${event.id} (channel buffer full)`);
            }
        } catch (err) {
            logger.error(`Outbox Publisher error publishing event ${event.id}:`, err.message);
            await outboxRepository.markFailed(event.id);
        }
    }
}

function startOutboxPublisher(intervalMs = 3000) {
    logger.info(`Outbox Publisher started (polling every ${intervalMs}ms)...`);
    const interval = setInterval(async () => {
        await processOutboxEvents();
    }, intervalMs);

    return () => clearInterval(interval);
}

module.exports = {
    processOutboxEvents,
    startOutboxPublisher,
};
