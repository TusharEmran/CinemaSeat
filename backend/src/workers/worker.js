const logger = require('../utils/logger');
const { startOutboxPublisher } = require('./outboxPublisher');
const startNotificationConsumer = require('./notificationConsumer');
const startAnalyticsConsumer = require('./analyticsConsumer');
const startHoldSweeper = require('./holdSweeper');
const { startPaymentReconciler } = require('./paymentReconciler');

async function startWorkerProcess() {
    logger.info('Initializing CinemaSeat Worker Process...');

    // Start background polling workers
    const stopPublisher = startOutboxPublisher(3000);
    const stopSweeper = startHoldSweeper(10000);
    const stopReconciler = startPaymentReconciler(30000);

    // Start RabbitMQ consumers
    try {
        await startNotificationConsumer();
        await startAnalyticsConsumer();
    } catch (err) {
        logger.warn('Worker process started with delayed RabbitMQ connection:', err.message);
    }

    logger.info('CinemaSeat Worker Process is running and active.');

    const gracefulShutdown = (signal) => {
        logger.info(`Received ${signal}. Shutting down worker process...`);
        stopPublisher();
        stopSweeper();
        stopReconciler();
        setTimeout(() => {
            logger.info('Worker process terminated cleanly.');
            process.exit(0);
        }, 1000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (require.main === module) {
    startWorkerProcess();
}

module.exports = startWorkerProcess;
