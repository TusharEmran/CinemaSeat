# Load Testing Strategy

To accurately measure the performance and concurrency handling of the CinemaSeat application, it is critical that load testing scripts are executed from an isolated host machine (e.g., your local laptop). 

> [!WARNING]
> **Avoid Resource Contention**
> Do not run load generation tools from within the same virtual machine or Docker host as the application stack. If the load generator and the API contend for the same CPU resources, the resulting metrics will reflect the limitations of your testing environment rather than the capacity of the service.

## Required Setup

We utilize [Grafana k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) for load generation. Please ensure it is installed on your execution machine before proceeding.

## Testing Scenarios

### Scenario A: High Concurrency Contest (Required)
Simulates a high-traffic rush where 100 concurrent requests attempt to hold the exact same seat. This scenario validates our strict database concurrency guarantees.
**Expected Result**: Exactly 1 successful hold (`201 Created`), 99 clean rejections (`409 Conflict`), and 0 oversold seats.

```bash
k6 run -e BASE_URL=http://localhost:8080 -e SEAT_LABEL=F12 load/scenario-a-one-seat.js
```

### Scenario B: Abandoned Hold Expiration (Required)
Validates the background reconciliation processes by simulating a user abandoning a hold.
**Prerequisite**: The stack must be running with a shortened Time-To-Live (TTL) for testing.

```bash
HOLD_TTL_SECONDS=15 docker compose up -d --build
BASE_URL=http://localhost:8080 ./load/scenario-b-hold-expiry.sh
```

### Scenario C: Capacity Breakpoint Analysis (Bonus)
A progressive ramp-up test designed to identify the maximum throughput limit of the deployed infrastructure.
**Note**: Execute this against the live deployed URL.

```bash
k6 run -e BASE_URL=https://[YOUR_DEPLOYED_URL] load/scenario-c-ramp.js
```

## Reporting Deliverables

Do not commit raw k6 JSON/terminal output dumps to the repository (the `load/results/` directory is `.gitignore`'d). Instead, you must synthesize the raw data into a professional written report.

The final deliverables should be placed in the `docs/proof/` directory and must include:
1. Total requests sent, successful holds, rejected conflicts, and the total count of oversold seats (which must be 0).
2. For Scenario C, include the `p95` latency curve.
3. **Crucial**: Provide a detailed architectural explanation of the identified system bottleneck. Evaluation rubrics state that the quality of the bottleneck analysis is graded, rather than the raw throughput numbers.
