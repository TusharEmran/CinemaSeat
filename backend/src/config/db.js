const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool(config.db);

pool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};
