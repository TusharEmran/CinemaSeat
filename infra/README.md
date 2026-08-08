# Infrastructure & Deployment

The infrastructure layer is engineered for disposability and strict reproducibility. Given the ephemeral nature of the hackathon environments (both Poridhi VMs and AWS accounts are terminated after the 12-hour window), zero reliance is placed on undocumented, manual server configurations.

**The Golden Rule of Deployment:**
Every deployment must be fully reproducible from a clean `git clone` using the provided automation. If a step is performed manually and not committed to this repository, it does not exist.

---

## Deployment Architectures

We provide two distinct deployment strategies. Neither path inherently scores higher on the core deployment rubric; evaluation is based on reliability, reachability, and reproducibility.

### Option 1: Poridhi VM Deployment (Primary Strategy)

This is the recommended, streamlined path to achieve a live environment quickly.

```bash
# Execute these commands on the designated infrastructure host VM.
git clone <repo-url> && cd CinemaSeat

# CRITICAL: The PUBLIC_BASE_URL must be the external, public-facing IP or Domain.
# If this points to `localhost`, the external gateway will be unable to reach the webhook callback.
export PUBLIC_BASE_URL=http://<public-ip>
export POSTGRES_PASSWORD=<secure-database-password>
export GATEWAY_CALLBACK_SECRET=<secure-random-secret>
export DATABASE_URL=postgres://cinema:$POSTGRES_PASSWORD@postgres:5432/cinemaseat
export REDIS_URL=redis://redis:6379

# Launch the production compose stack
docker compose -f docker-compose.yml -f infra/compose/compose.prod.yml up -d --wait

# Verify deployment externally
./scripts/smoke.sh http://<public-ip>
```

**Final Steps**: Ensure the Poridhi load balancer routes port `80` traffic to the host, and update the primary `README.md` with the finalized deployment URL.

### Option 2: AWS Elastic Compute Deployment (Advanced / Bonus)

A continuous deployment approach using Terraform for AWS provisioning. This path demonstrates advanced DevOps practices but introduces higher complexity and risk. 

> [!WARNING]
> Only attempt the AWS deployment strategy once all core application milestones are functioning flawlessly locally. Incomplete bonus objectives yield lower overall scores than completed core requirements.

For detailed instructions on the AWS deployment path, refer to the [`terraform/README.md`](terraform/README.md).

---

## Pre-Flight Deployment Checklist

Do not consider the application "live" until every condition below is met:

- [ ] `./scripts/smoke.sh <public-url>` executes successfully from an **external** terminal.
- [ ] `GET /health` returns a `200 OK` status in under 1 second, even when the `gateway` container is deliberately stopped.
- [ ] The external gateway container can successfully resolve and reach the internal webhook URL (`docker compose exec gateway wget -qO- $PUBLIC_BASE_URL/health`).
- [ ] A complete end-to-end payment flow resolves successfully against the live public URL.
- [ ] The Continuous Deployment pipeline (if configured) deploys successfully on a merge to `main` without requiring manual SSH intervention.
- [ ] The final deployed URL has been updated in the root `README.md`.
- [ ] In a disaster recovery scenario, the entire infrastructure could be rebuilt from a clean clone in under 15 minutes.
