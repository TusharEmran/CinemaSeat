const bookingService = require('../services/bookingService');
const logger = require('../utils/logger');

function startHoldSweeper(intervalMs = 10000) {
    logger.info(`Hold Sweeper worker started (running every ${intervalMs}ms)...`);
    const interval = setInterval(async () => {
        try {
            await bookingService.expireStaleHoldsAndBookings();
        } catch (err) {
            logger.error('Error running Hold Sweeper:', err.message);
        }
    }, intervalMs);

    return () => clearInterval(interval);
}

module.exports = startHoldSweeper;
