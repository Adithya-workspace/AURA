# Scenario seeds

Each incident run clones one of these worlds. Numbers are deterministic from the scenario seed.

## Payments (primary demo)

- Logs: 12,482 events, 347 errors in 30 minutes.
- Top error: `DB_TIMEOUT: could not acquire connection from pool after 5000ms` (302).
- Also: `POST /v1/charge 504`, `HikariPool-1 - Connection is not available, request timed out`.
- Transactions: 1,886 charges, 18.4% failed. Methods: card, UPI, netbanking, wallet.
- Database: 98/100 connections, 98% utilization, wait queue 46.
- Latency: p95 4.8s.
- Decoys: checkout-service CPU stuck near 91%; payment-service v2.4.1 dependency bump.
- Correlation: error rate, DB utilization, and latency share an onset. Checkout CPU does not.
- Root cause: pool exhaustion. Confidence 94.
- Fix: `update_db_pool_size` 100 → 200. Full recovery: error 1.2%, latency 620ms, DB utilization 61%.
- Partial-recovery toggle: the pool change alone lands near 7% / 2.1s / 78%. The agent then proposes `restart_service` on payment-service.

## Authentication

- JWT signature mismatches after config push `kid=2026-10-08`.
- Decoy: status-page stylesheet deploy.
- Fix: `rollback_config`.

## Orders

- `orders-queue` depth 1,480 with 2 consumers and 240s lag.
- Decoy: catalog-service CPU.
- Fix: `scale_workers` 2 → 6.

## Notifications

- SendGrid 429, circuit open, SES fallback unused.
- Decoy: receipt template spacing deploy.
- Fix: `switch_provider` to `ses`.

`delete_records` is in the catalog and always blocked.
