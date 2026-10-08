# Demo script (3–5 minutes)

1. Introduce the problem. On-call engineers lose minutes hopping between logs, metrics, and databases. AURA is a first responder, not a chatbot.
2. Open the dashboard. Point at system status, active incidents, resolved today, and success rate. These come from SQLite.
3. Click **Run Demo Incident**. The payment story starts through the real API.
4. Watch the plan. Nine steps appear. The stage line moves from Understanding to Investigating.
5. Let the tools run. Call out the log line `DB_TIMEOUT`, 12,482 events and 347 errors, degraded `POST /v1/charge`, 18.4% payment failures, and the database at 98/100 connections. Mention the checkout CPU and the harmless deploy as decoys.
6. Correlation. About 87% of failures line up with database timeouts, not the busy checkout service.
7. Root cause. Connection pool exhaustion, about 94% confidence, with ruled-out hypotheses beside it.
8. Approval. The card says 100 → 200. Do not click yet. This is the human gate. Write tools cannot run before it.
9. Click **Authorize Action**. The pool change is applied to that run's simulated world. Progress steps tick from backend events.
10. Verification. Error rate 18.4% → 1.2%, latency 4.8s → 620ms, DB utilization 98% → 61%. The banner says recovery confirmed.
11. Open the report. Download Markdown or use Print / PDF.
12. Optional. Start another payment incident with **Partial recovery** checked. The first change is not enough. The agent adapts and asks for a second approval.
13. Close on why this is agentic. The model chooses tools, the server enforces read versus write versus destructive, a person approves impact, and verification decides whether to adapt or finish. A chatbot would have stopped at an answer.
