## What changed

<!-- One or two sentences. -->

## Why

<!-- Link the milestone or the failure this fixes. -->

## Checklist

- [ ] CI is green (nothing merges otherwise)
- [ ] Tests cover the change — and if it touches holds or callbacks, a concurrency or duplicate test
- [ ] No hardcoded `HOLD_TTL_SECONDS` (or any other config that belongs in env)
- [ ] `docker compose up` still works from a clean clone
- [ ] README updated if the hold or seat-map request shape changed
