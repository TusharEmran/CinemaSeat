const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const config = require('../src/config');

describe('HMAC Signature Verification Security', () => {
    test('Reject request missing X-Signature header with 401 Unauthorized', async () => {
        const res = await request(app)
            .post('/webhooks/payment')
            .set('Content-Type', 'application/json')
            .send({ event_id: 'evt_no_sig', booking_ref: 'bk_123', status: 'SUCCEEDED' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('Reject request with invalid X-Signature header with 401 Unauthorized', async () => {
        const res = await request(app)
            .post('/webhooks/payment')
            .set('X-Signature', 'invalid_signature_hash_12345')
            .set('Content-Type', 'application/json')
            .send({ event_id: 'evt_bad_sig', booking_ref: 'bk_123', status: 'SUCCEEDED' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('Accept request with valid HMAC signature calculated from raw request body', async () => {
        const payload = { event_id: `evt_valid_sig_${Date.now()}`, booking_ref: 'non_existent_ref', status: 'SUCCEEDED' };
        const rawBody = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', config.gateway.secret)
            .update(rawBody)
            .digest('hex');

        const res = await request(app)
            .post('/webhooks/payment')
            .set('X-Signature', signature)
            .set('Content-Type', 'application/json')
            .send(rawBody);

        expect(res.status).toBe(200);
    });
});
