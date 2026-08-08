# Convenience only. Everything here is a plain docker/npm command underneath —
# nothing in this file is required to run the project. `docker compose up` is
# still the whole story from a clean clone.

.DEFAULT_GOAL := help
SHELL := /bin/bash
BASE_URL ?= http://localhost:8080

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Running ──────────────────────────────────────────────────────────────────
.PHONY: up
up: ## Bring the whole stack up
	docker compose up --build

.PHONY: up-d
up-d: ## Bring the stack up detached and wait for health
	docker compose up -d --build --wait

.PHONY: down
down: ## Stop everything
	docker compose down

.PHONY: reset
reset: ## Stop everything and drop the database volume
	docker compose down -v && docker compose up --build

.PHONY: logs
logs: ## Tail all logs
	docker compose logs -f --tail 100

.PHONY: logs-worker
logs-worker: ## Tail the worker (hold sweeps, reconciliation)
	docker compose logs -f --tail 100 worker

.PHONY: short-ttl
short-ttl: ## Run with a 15s hold TTL, for Scenario B
	HOLD_TTL_SECONDS=15 docker compose up --build

# ── Testing ──────────────────────────────────────────────────────────────────
.PHONY: test
test: ## Unit tests
	cd backend && npm test

.PHONY: test-integration
test-integration: ## Integration tests (real Postgres + Redis)
	cd backend && npm run test:integration

.PHONY: lint
lint: ## Lint and typecheck
	cd backend && npm run lint && npm run typecheck

.PHONY: smoke
smoke: ## Smoke test a running stack
	./scripts/smoke.sh $(BASE_URL)

.PHONY: verify
verify: ## The oversell check, straight against the database
	./scripts/verify-no-oversell.sh

# ── Proof ────────────────────────────────────────────────────────────────────
.PHONY: scenario-a
scenario-a: ## Scenario A — 100 concurrent holds on one seat
	k6 run -e BASE_URL=$(BASE_URL) -e SEAT_LABEL=F12 load/scenario-a-one-seat.js

.PHONY: scenario-b
scenario-b: ## Scenario B — abandoned hold (start with `make short-ttl` first)
	BASE_URL=$(BASE_URL) ./load/scenario-b-hold-expiry.sh

.PHONY: scenario-c
scenario-c: ## Scenario C — ramp to the breakpoint
	k6 run -e BASE_URL=$(BASE_URL) load/scenario-c-ramp.js

# ── Failure drills ───────────────────────────────────────────────────────────
.PHONY: gateway-down
gateway-down: ## Stop the gateway and check nothing else breaks
	docker compose stop gateway && sleep 2 && ./scripts/smoke.sh $(BASE_URL)

.PHONY: gateway-up
gateway-up: ## Restart the gateway and watch pending payments recover
	docker compose start gateway && docker compose logs -f --tail 50 worker

.PHONY: drill
drill: ## Exercise every gateway force header
	./scripts/force-header-drill.sh $(BASE_URL)

# ── Database ─────────────────────────────────────────────────────────────────
.PHONY: psql
psql: ## Open a psql shell
	docker compose exec postgres psql -U cinema -d cinemaseat
