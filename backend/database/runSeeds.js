const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
const logger = require('../src/utils/logger');

async function runSeeds() {
    const client = await pool.connect();
    try {
        logger.info('Starting database seeds...');
        const seedPath = path.join(__dirname, 'seeds', 'seeds.sql');
        const sql = fs.readFileSync(seedPath, 'utf8');
        await client.query(sql);
        logger.info('Database seeds executed successfully.');
    } catch (err) {
        logger.error('Database seeding failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runSeeds()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Seed execution failed:', err);
            process.exit(1);
        });
}

module.exports = runSeeds;
