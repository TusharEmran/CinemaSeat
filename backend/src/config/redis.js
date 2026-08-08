const { createClient } = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({ url: config.redis.url });

        redisClient.on('error', (err) => {
            if (isRedisConnected) {
                logger.warn('Redis Connection Error:', err.message);
            }
            isRedisConnected = false;
        });

        redisClient.on('connect', () => {
            isRedisConnected = true;
            logger.info('Connected to Redis server.');
        });

        try {
            await redisClient.connect();
        } catch (err) {
            logger.warn('Initial Redis connection failed. Falling back to non-cached / fail-open mode:', err.message);
            isRedisConnected = false;
        }
    }
    return redisClient;
}

function isConnected() {
    return isRedisConnected;
}

module.exports = {
    getRedisClient,
    isConnected,
};
