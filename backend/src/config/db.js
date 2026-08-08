const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_POOL_MAX || '50', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    }
    : config.db;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};
