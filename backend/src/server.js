const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const runMigrations = require('../database/runMigrations');
const runSeeds = require('../database/runSeeds');

async function startServer() {
    try {
        logger.info('Initializing CinemaSeat API server...');
        
        // Auto-run migrations and seeds in non-production or first startup
        try {
            await runMigrations();
            await runSeeds();
        } catch (err) {
            logger.warn('Migration or seed execution note:', err.message);
        }

        const server = app.listen(config.port, () => {
            logger.info(`CinemaSeat API server running on port ${config.port} [env: ${config.env}]`);
        });

        const gracefulShutdown = (signal) => {
            logger.info(`Received ${signal}. Gracefully shutting down CinemaSeat API server...`);
            server.close(() => {
                logger.info('HTTP server closed. Exiting process.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err) {
        logger.error('Failed to start API server:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = startServer;
