const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function runMigrations() {
    const client = await pool.connect();
    try {
        logger.info('Starting database migrations...');
        const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await client.query(sql);
        logger.info('Database migrations executed successfully.');
    } catch (err) {
        logger.error('Database migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = runMigrations;
