require('dotenv').config();

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_cinemaseat_2026',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'cinemaseat',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: parseInt(process.env.REDIS_CACHE_TTL || '300', 10),
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        exchange: 'cinemaseat.events',
        queues: {
            notifications: 'notifications.queue',
            analytics: 'analytics.queue',
            notificationsDlq: 'notifications.dlq',
            analyticsDlq: 'analytics.dlq',
        },
    },
    gateway: {
        url: process.env.GATEWAY_URL || 'http://localhost:9000',
        secret: process.env.GATEWAY_SECRET || 'cinemaseat_gateway_secret_key',
        timeoutMs: parseInt(process.env.GATEWAY_TIMEOUT_MS || '5000', 10),
    },
    booking: {
        holdDurationMinutes: parseInt(process.env.HOLD_DURATION_MINUTES || '10', 10),
    },
};
