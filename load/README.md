# Load tests

**Run these from your host or laptop, never from inside the stack.** If k6 and the API fight
over the same two vCPUs, you are measuring your load generator, not your service.

```bash
# Scenario A — required. Exactly one winner, 99 clean rejections, 0 oversell.
k6 run -e BASE_URL=http://localhost:8080 -e SEAT_LABEL=F12 load/scenario-a-one-seat.js

# Scenario B — required. Needs a short TTL.
HOLD_TTL_SECONDS=15 docker compose up -d --build
BASE_URL=http://localhost:8080 ./load/scenario-b-hold-expiry.sh

# Scenario C — bonus. Point it at the deployed URL.
k6 run -e BASE_URL=https://your-deployed-url load/scenario-c-ramp.js
```

Install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/>

## What to record

Raw k6 output is not the deliverable. Write the summary into `docs/proof/` — requests sent,
successes, rejections, oversell count, and for Scenario C the p95 curve plus **your explanation
of the bottleneck**. The brief is explicit that the explanation is what earns the marks and that
raw throughput is not compared between teams.

Keep raw dumps out of git (`load/results/` is gitignored); commit the written summary instead.
