# Contributing

Start with the README and architecture document. Work against a disposable local MySQL database and synthetic accounts. Do not connect the application or tests to the original server.

Keep domain rules in `src/services.py`, ownership/authentication in `src/api.py`, parameterized access in `src/database.py`, and UI in the relevant `web/` screen. Use a transaction when a business operation changes multiple rows. Do not move secrets, private documents or account records into browser storage or the service-worker asset list.

Use Python 3.12 and Node 24. Before proposing a change, run the relevant pytest suite, Ruff checks, `npm run build` and browser tests when the behavior changes. MySQL tests require `BAXI_RUN_INTEGRATION=1`; browser tests use the seeded demo accounts. Update screenshots and documentation when UI or setup behavior changes. Respect reduced-motion settings, keyboard focus, RTL layout, labelled controls and narrow mobile widths.

Money is integer IRR. Python coordinates are latitude/longitude; SQL points use longitude/latitude. Preserve all four services and server-side WOMEN/capacity/approval checks. New payment mutations must support an idempotency key and retry tests.

Use a focused branch and pull request. Explain the behavior, evidence and limitations. Never describe unverified external integrations as working. Original design/database artifacts are historical: edit current documentation instead of rewriting the historical evidence. Licensing has not yet been agreed by all original contributors.
