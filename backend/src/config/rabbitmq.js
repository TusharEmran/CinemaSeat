const amqp = require('amqplib');
const config = require('./index');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

async function getRabbitMQChannel() {
    if (channel) return channel;

    try {
        connection = await amqp.connect(config.rabbitmq.url);
        channel = await connection.createChannel();

        // Declare main exchange
        await channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });

        // Assert queues and bindings
        const { notifications, analytics, notificationsDlq, analyticsDlq } = config.rabbitmq.queues;

        // Dead Letter Queues
        await channel.assertQueue(notificationsDlq, { durable: true });
        await channel.assertQueue(analyticsDlq, { durable: true });

        // Main Queues with DLQ settings
        await channel.assertQueue(notifications, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': notificationsDlq,
            },
        });

        await channel.assertQueue(analytics, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': analyticsDlq,
            },
        });

        // Bindings
        // Notifications queue listens to relevant booking/payment events
        await channel.bindQueue(notifications, config.rabbitmq.exchange, 'PaymentSucceeded');
        await channel.bindQueue(notifications, config.rabbitmq.exchange, 'PaymentFailed');
        await channel.bindQueue(notifications, config.rabbitmq.exchange, 'BookingConfirmed');
        await channel.bindQueue(notifications, config.rabbitmq.exchange, 'BookingCreated');

        // Analytics queue listens to all events
        await channel.bindQueue(analytics, config.rabbitmq.exchange, '#');

        logger.info('Connected to RabbitMQ and initialized exchange/queues.');
        return channel;
    } catch (err) {
        logger.error('RabbitMQ connection error:', err.message);
        throw err;
    }
}

async function closeRabbitMQ() {
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
        channel = null;
        connection = null;
    } catch (err) {
        logger.error('Error closing RabbitMQ connection:', err.message);
    }
}

module.exports = {
    getRabbitMQChannel,
    closeRabbitMQ,
};
