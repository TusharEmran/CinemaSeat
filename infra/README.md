# Infrastructure

**Your infrastructure is disposable.** The lab runs 12 hours from launch, with no extension, and
when it ends the VM and the AWS account both disappear. Only what is in this repository
survives — so nothing here may depend on a step someone did by hand and did not write down.

Every deploy must be reproducible from a clean clone.

---

## Option 1 — Poridhi VM (the simpler path)

Fewer moving parts, faster to get live. Neither option scores higher for Deployment; judges
check that it is deployed and reachable, not where.

```bash
# On the infrastructure owner's VM. That lab hosts the deployment and is not
# stopped, restarted, or used for experiments — other members use their own.
git clone <repo-url> && cd CinemaSeat

export PUBLIC_BASE_URL=http://<public-ip>          # what the gateway calls back on
export POSTGRES_PASSWORD=<something-not-cinema>
export GATEWAY_CALLBACK_SECRET=<random>
export DATABASE_URL=postgres://cinema:$POSTGRES_PASSWORD@postgres:5432/cinemaseat
export REDIS_URL=redis://redis:6379

docker compose -f docker-compose.yml -f infra/compose/compose.prod.yml up -d --wait
./scripts/smoke.sh http://<public-ip>
```

Then put the URL in [`../README.md`](../README.md) and point the Poridhi load balancer at port 80.

### The deploy-day mistake to avoid

`PUBLIC_BASE_URL` must be the **public** URL. Inside the gateway container, `localhost` is the
gateway. Get this wrong and everything looks fine until you notice no payment ever confirms.

---

## Option 2 — AWS (the harder path, bonus marks)

More to learn, more to break, and continuous deployment genuinely matters. See
[`terraform/`](terraform/).

Attempt this only once the required milestones are solid. A half-built bonus is worth less than
a finished requirement.

---

## Checklist before you call it deployed

- [ ] `./scripts/smoke.sh <public-url>` passes from **outside** the VM
- [ ] `/health` returns 200 with the gateway container stopped
- [ ] The gateway can reach your callback URL (`docker compose exec gateway wget -qO- $PUBLIC_BASE_URL/health`)
- [ ] A payment completes end to end against the live URL
- [ ] CD deploys on push to `main` without anyone SSHing in
- [ ] The deployed URL is in `README.md`
- [ ] You could rebuild this from a clean clone in fifteen minutes if the lab vanished
