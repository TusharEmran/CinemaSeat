const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.GATEWAY_PORT || 9000;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || 'cinemaseat_gateway_secret_key';

console.log(`[GATEWAY] Initializing CinemaSeat Gateway Mock Server on port ${PORT}...`);

// Helper to send HMAC signed webhook callbacks with retry logic
async function sendWebhookWithRetry(url, payload, maxRetries = 8) {
    const rawBody = JSON.stringify(payload);
    const signature = crypto
        .createHmac('sha256', GATEWAY_SECRET)
        .update(rawBody)
        .digest('hex');

    let attempt = 0;
    let delay = 1000; // start 1s

    while (attempt < maxRetries) {
        attempt += 1;
        try {
            console.log(`[GATEWAY] Dispatching webhook callback to ${url} (Attempt ${attempt}/${maxRetries}):`, payload);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature': signature,
                },
                body: rawBody,
            });

            if (response.ok) {
                console.log(`[GATEWAY] Webhook callback delivered successfully (HTTP ${response.status})`);
                return;
            } else {
                console.warn(`[GATEWAY] Webhook callback failed (HTTP ${response.status}). Retrying in ${delay}ms...`);
            }
        } catch (err) {
            console.error(`[GATEWAY] Webhook dispatch error: ${err.message}. Retrying in ${delay}ms...`);
        }

        await new Promise((r) => setTimeout(r, delay));
        delay *= 2; // exponential backoff
    }

    console.error(`[GATEWAY] Webhook delivery failed after ${maxRetries} attempts for event ${payload.event_id}`);
}

// POST /charge
app.post('/charge', async (req, res) => {
    const { amount, currency, booking_ref, callback_url } = req.body;
    const mockMode = req.headers['x-mock-mode'];
    const mockForce = req.headers['x-mock-force'];

    if (!amount || !booking_ref || !callback_url) {
        return res.status(400).json({ message: 'amount, booking_ref, and callback_url are required' });
    }

    // Check 2% random 500 error
    if (mockForce === 'timeout') {
        return res.status(500).json({ message: 'Simulated Gateway 500 Internal Error' });
    }

    if (mockMode !== 'deterministic' && Math.random() < 0.02) {
        console.log('[GATEWAY] Triggered 2% random /charge 500 error');
        return res.status(500).json({ message: 'Simulated Gateway Internal Error' });
    }

    const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;

    // Determine success or fail
    let status = 'SUCCEEDED';
    if (mockForce === 'fail') {
        status = 'FAILED';
    } else if (mockMode !== 'deterministic' && Math.random() < 0.10) {
        status = 'FAILED'; // 10% payment failure rate
    }

    // Determine callback delay
    let delayMs = Math.floor(Math.random() * (15000 - 2000 + 1)) + 2000; // 2-15s
    let sendBeforeResponse = false;

    if (mockForce === 'race') {
        delayMs = 100;
        sendBeforeResponse = true;
    } else if (mockMode === 'deterministic') {
        delayMs = 500;
    }

    const callbackPayload = {
        event_id: eventId,
        payment_id: paymentId,
        booking_ref,
        status,
        amount,
        currency: currency || 'BDT',
        reason: status === 'FAILED' ? 'Insufficient funds or card declined' : null,
    };

    if (sendBeforeResponse) {
        console.log('[GATEWAY] Simulating Race Condition: Dispatching webhook callback BEFORE HTTP 202 response returns!');
        sendWebhookWithRetry(callback_url, callbackPayload);
        if (mockForce === 'duplicate') {
            sendWebhookWithRetry(callback_url, callbackPayload);
        }
    } else {
        setTimeout(() => {
            sendWebhookWithRetry(callback_url, callbackPayload);
            // 8% duplicate callback simulation
            if (mockForce === 'duplicate' || (mockMode !== 'deterministic' && Math.random() < 0.08)) {
                console.log('[GATEWAY] Triggering 8% duplicate callback simulation for event:', eventId);
                setTimeout(() => sendWebhookWithRetry(callback_url, callbackPayload), 1000);
            }
        }, delayMs);
    }

    return res.status(202).json({
        payment_id: paymentId,
        status: 'PENDING',
    });
});

// POST /refund
app.post('/refund', (req, res) => {
    const { payment_id, amount, reason } = req.body;
    if (!payment_id) {
        return res.status(400).json({ message: 'payment_id is required' });
    }

    return res.status(202).json({
        refund_id: `ref_${crypto.randomBytes(6).toString('hex')}`,
        payment_id,
        status: 'REFUNDED',
    });
});

// POST /otp/send
app.post('/otp/send', (req, res) => {
    const { phone, ref, callback_url } = req.body;
    const mockForce = req.headers['x-mock-force'];

    // 10% OTP lost simulation
    if (mockForce === 'timeout' || (req.headers['x-mock-mode'] !== 'deterministic' && Math.random() < 0.10)) {
        console.log('[GATEWAY] Simulating 10% lost OTP for phone:', phone);
        return res.status(200).json({ message: 'OTP requested (simulated lost in transit)' });
    }

    const code = '123456';
    if (callback_url) {
        setTimeout(() => {
            sendWebhookWithRetry(callback_url, {
                ref,
                phone,
                status: 'DELIVERED',
            });
        }, 1000);
    }

    return res.status(200).json({
        message: 'OTP sent successfully',
        reference_ref: ref,
        code,
    });
});

// POST /otp/verify
app.post('/otp/verify', (req, res) => {
    const { phone, ref, code } = req.body;
    const mockForce = req.headers['x-mock-force'];

    if (mockForce === 'fail' || code !== '123456') {
        return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    return res.status(200).json({
        status: 'VERIFIED',
        message: 'OTP verified successfully',
    });
});

// GET /health
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'cinemaseat-gateway' });
});

app.listen(PORT, () => {
    console.log(`[GATEWAY] Mock Payment/OTP Gateway listening on port ${PORT}`);
});
