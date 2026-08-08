const { pool } = require('../src/config/db');
const runMigrations = require('../database/runMigrations');
const runSeeds = require('../database/runSeeds');

beforeAll(async () => {
    try {
        await runMigrations();
        await runSeeds();
    } catch (err) {
        console.error('Test setup error:', err);
    }
});

afterAll(async () => {
    try {
        await pool.end();
    } catch (err) {
        // ignore close error
    }
});
