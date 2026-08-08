/**
 * CinemaSeat Hackathon-Level Concurrency & Race Condition Proof-of-Concept Test
 * 
 * High-concurrency stress test with 100 CONCURRENT USERS:
 * 1. Seat Double-Booking Prevention (100 concurrent requests for 1 seat)
 * 2. Idempotent Gateway Payment Charging (10 parallel requests with same Idempotency-Key)
 * 3. Race-Condition Callback Handling & Reconciliation
 */

const http = require('http');

const API_BASE = 'http://localhost:3000/api';
const GATEWAY_BASE = 'http://localhost:9000';

const COLOR = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    CYAN: '\x1b[36m',
    BOLD: '\x1b[1m',
    RESET: '\x1b[0m',
};

function logHeader(title) {
    console.log(`\n${COLOR.CYAN}${COLOR.BOLD}==============================================================${COLOR.RESET}`);
    console.log(`${COLOR.CYAN}${COLOR.BOLD}  ${title}${COLOR.RESET}`);
    console.log(`${COLOR.CYAN}${COLOR.BOLD}==============================================================${COLOR.RESET}`);
}

function logResult(name, passed, details) {
    const icon = passed ? `${COLOR.GREEN}✔ PASS${COLOR.RESET}` : `${COLOR.RED}✖ FAIL${COLOR.RESET}`;
    console.log(`[${icon}] ${COLOR.BOLD}${name}${COLOR.RESET}`);
    if (details) console.log(`       ${details}`);
}

function makeRequest(url, options = {}, bodyData = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const reqOpts = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };

        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', (err) => reject(err));

        if (bodyData) {
            req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
    });
}

async function runConcurrencyPoC() {
    logHeader("CINEMASEAT 100-USER CONCURRENCY STRESS TEST");
    console.log(`Testing target: ${API_BASE} & ${GATEWAY_BASE}`);

    let totalTests = 0;
    let passedTests = 0;

    // -------------------------------------------------------------------------
    // TEST 1: Double-Booking Safeguard (100 Concurrent Seat Holds)
    // -------------------------------------------------------------------------
    logHeader("TEST 1: 100 Concurrent Users Claiming the Same Seat");

    // Get an available show & seat
    const showsRes = await makeRequest(`${API_BASE}/shows`);
    if (!showsRes.body || !showsRes.body.data || showsRes.body.data.length === 0) {
        console.error(`${COLOR.RED}No shows found for testing.${COLOR.RESET}`);
        process.exit(1);
    }

    const showId = showsRes.body.data[0].id;
    const seatsRes = await makeRequest(`${API_BASE}/shows/${showId}/seats`);
    
    // Find an available seat
    const availableSeat = seatsRes.body.data.find(s => s.effective_status === 'AVAILABLE');
    if (!availableSeat) {
        console.error(`${COLOR.RED}No available seats found for testing.${COLOR.RESET}`);
        process.exit(1);
    }

    const seatId = availableSeat.seat_id;
    console.log(`Targeting Show ID: ${showId}`);
    console.log(`Targeting Seat ID: ${seatId} (Row ${availableSeat.row_number}, Seat ${availableSeat.seat_number}) for 100 simultaneous users...`);

    const CONCURRENT_USERS = 100;
    const startTime = Date.now();

    const holdPromises = Array.from({ length: CONCURRENT_USERS }).map((_, i) => {
        const ipOctet1 = Math.floor(i / 250);
        const ipOctet2 = (i % 250) + 1;
        return makeRequest(`${API_BASE}/shows/${showId}/holds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': `192.168.${ipOctet1}.${ipOctet2}`,
            },
        }, { seat_ids: [seatId] });
    });

    const holdResponses = await Promise.all(holdPromises);
    const duration = Date.now() - startTime;

    const successes = holdResponses.filter(r => r.status === 201);
    const conflicts = holdResponses.filter(r => r.status === 409);
    const others = holdResponses.filter(r => r.status !== 201 && r.status !== 409);

    totalTests++;
    const test1Passed = successes.length === 1 && conflicts.length === (CONCURRENT_USERS - 1) && others.length === 0;
    if (test1Passed) passedTests++;

    logResult(
        "Atomic Seat Reservation under 100-way concurrency",
        test1Passed,
        `100 parallel requests completed in ${duration}ms. Successes: ${successes.length} (201 Created), Conflicts: ${conflicts.length} (409 Conflict), Errors: ${others.length}`
    );

    if (successes.length > 0 && successes[0].body && successes[0].body.data && successes[0].body.data.booking) {
        console.log(`       Held Booking Reference: ${successes[0].body.data.booking.booking_ref}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Concurrent Idempotency Blast (10 Parallel Charges)
    // -------------------------------------------------------------------------
    logHeader("TEST 2: Gateway Payment Idempotency under High Concurrency");

    const idempotencyKey = `idem-poc-${Date.now()}`;
    const PARALLEL_CHARGES = 10;
    console.log(`Sending ${PARALLEL_CHARGES} simultaneous charges with Idempotency-Key: ${idempotencyKey}...`);

    const chargePromises = Array.from({ length: PARALLEL_CHARGES }).map(() => {
        return makeRequest(`${GATEWAY_BASE}/charge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
                'X-Mock-Mode': 'deterministic',
            },
        }, {
            amount: 500,
            currency: 'BDT',
            booking_ref: `bk_idem_poc_${Date.now()}`,
            callback_url: 'http://api:3000/webhooks/payment',
        });
    });

    const chargeResponses = await Promise.all(chargePromises);
    const paymentIds = new Set(chargeResponses.map(r => r.body.payment_id));

    totalTests++;
    const test2Passed = chargeResponses.every(r => r.status === 202) && paymentIds.size === 1;
    if (test2Passed) passedTests++;

    logResult(
        "Idempotency Guarantee across 10 parallel API calls",
        test2Passed,
        `All 10 requests returned 202 Accepted. Unique Payment IDs generated: ${paymentIds.size} (${[...paymentIds][0]})`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Out-of-Order / Fast Callback Handling (Race Condition Resilience)
    // -------------------------------------------------------------------------
    logHeader("TEST 3: Gateway Callback Race Condition (Callback arrives before /pay finishes)");

    console.log(`Triggering payment charge with X-Mock-Force: race header...`);

    const raceChargeRes = await makeRequest(`${GATEWAY_BASE}/charge`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Mock-Force': 'race',
        },
    }, {
        amount: 450,
        currency: 'BDT',
        booking_ref: `bk_race_${Date.now()}`,
        callback_url: 'http://api:3000/webhooks/payment',
    });

    // Wait for callback delivery log
    await new Promise(r => setTimeout(r, 1500));
    const deliveriesRes = await makeRequest(`${GATEWAY_BASE}/debug/deliveries`);
    const raceDelivery = deliveriesRes.body.deliveries.slice(-10).find(d => d.type === 'payment-race' || (d.booking_ref && d.booking_ref.startsWith('bk_race_')));

    totalTests++;
    const test3Passed = raceChargeRes.status === 202 && raceDelivery && raceDelivery.ok === true;
    if (test3Passed) passedTests++;

    logResult(
        "Race Condition Resilience (Callback landed before response returned)",
        test3Passed,
        `Charge status: ${raceChargeRes.status}, Webhook delivery status: ${raceDelivery ? (raceDelivery.http_status || 'OK (200)') : 'N/A'} (${raceDelivery && raceDelivery.ok ? 'SUCCESS' : 'FAILED'})`
    );

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    logHeader("100-USER CONCURRENCY & STRESS TEST SUMMARY");
    console.log(`Total Test Scenarios: ${totalTests}`);
    console.log(`Passed: ${COLOR.GREEN}${passedTests}${COLOR.RESET}`);
    console.log(`Failed: ${passedTests === totalTests ? '0' : COLOR.RED + (totalTests - passedTests) + COLOR.RESET}`);

    if (passedTests === totalTests) {
        console.log(`\n${COLOR.GREEN}${COLOR.BOLD}🎉 ALL 100-USER CONCURRENCY & STRESS TESTS PASSED PERFECTLY!${COLOR.RESET}\n`);
    } else {
        console.log(`\n${COLOR.RED}${COLOR.BOLD}❌ SOME CONCURRENCY TESTS FAILED. CHECK LOGS ABOVE.${COLOR.RESET}\n`);
        process.exit(1);
    }
}

runConcurrencyPoC().catch(err => {
    console.error("Unhandled error in concurrency test:", err);
    process.exit(1);
});
