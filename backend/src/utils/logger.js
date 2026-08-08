const config = require('../config');

const logger = {
    info: (message, ...args) => {
        console.log(`[INFO] [${new Date().toISOString()}] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (config.env === 'development' || process.env.DEBUG) {
            console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, ...args);
        }
    },
};

module.exports = logger;
