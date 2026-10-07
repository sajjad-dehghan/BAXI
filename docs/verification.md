# Verification record — 2026-10-07

Evidence below describes the rebuilt local demo, not the historical Qt application's runtime or a public deployment.

## Passed locally

- **59 pytest cases** with real MySQL 8.4, first against the disposable review database and then against the Compose database using the restricted `baxi` user. Cases cover all four services, atomic rollback, competing acceptance, state/ownership, WOMEN and capacity restrictions, longitude/latitude cutoff, Tehran polygon inclusion and server rejection outside the city, wallet and cash settlement, insufficient funds, retry keys, rating, hashing, OTP expiry/rate limiting, private document access and all 20 reports.
- **6 Playwright scenarios** against the production build in Chrome, both via Vite preview and through Docker/nginx at `127.0.0.1:8080`: public/offline shell and manifest, passenger-to-driver journey and wallet/rating, driver onboarding and four-document approval, female/cargo quotation, all 20 staff reports, and Tehran map selection/editing with keyboard and device-location checks.
- The wallet browser test commits a transfer, drops the first response, retries with the same key and verifies only one credit. This exercises an actual ambiguous network outcome rather than only clicking twice.
- Axe checks with WCAG 2 A/AA and 2.1 AA tags report zero detected violations on tested login, passenger, wallet, registration, installation dialog and staff/report screens. This is automated coverage, not a complete manual accessibility certification.
- Layout overflow checks at **360, 390, 768 and 1440 CSS pixels**, plus visual inspection of captured login, passenger and staff screens. The mobile booking page scrolls naturally; its bottom navigation stays fixed.
- Offline reload opens the public shell, disables online actions, and confirms no `/api` URL appears in Cache Storage. Manifest icon resources load successfully.
- Chrome DevTools' installability check in a separate persistent test profile returns an empty error list. This checks browser installation prerequisites; it does not replace testing installation on a physical device.
- TypeScript strict build, unused-local checks, Ruff lint/format and Prettier checks pass. `npm audit` and `pip-audit --local` report zero known vulnerabilities in the installed dependency graphs at this check; pip was upgraded to 26.2.1 in the development environment and pinned for Docker/CI bootstrap. This is not a complete security audit.
- Docker builds the frontend and Python API, initializes MySQL, seeds synthetic accounts and passes API health checks. A separate Compose project with **fresh empty volumes** successfully bootstrapped all services and one completed journey in each of the four service categories. The temporary bootstrap project and volumes were removed afterward.

## Reproduce

See the README for the development environment. For the final Docker app:

```powershell
$env:BAXI_RUN_INTEGRATION='1'
python -m pytest -q
$env:BAXI_BASE_URL='http://127.0.0.1:8080'
npm run test:e2e
```

The Python suite reads the untracked `.env` and requires a local, seeded disposable MySQL database. Browser tests create synthetic driver accounts and journeys; they should never run against real user data. `BAXI_BASE_URL` bypasses the automatic preview server and exercises an existing deployment. The API must permit that browser origin.

## Limits and observed warnings

- The test environment currently emits a Starlette TestClient deprecation warning for `httpx`; it does not fail the suite. A future migration to `httpx2` should be checked against FastAPI's supported test-client interface.
- Actual OS installation and physical iPhone/Android behavior were not manually tested. Chrome exercised service-worker registration/control, offline loading, manifest resources and keyboard installation help; Safari installation instructions are provided.
- The first official PyPI download failed because `files.pythonhosted.org` could not resolve in this environment. A locally selected reachable PyPI mirror completed the Python installation. The committed default index is official PyPI.
- Playwright's bundled Chromium download was blocked by the CDN's regional response; local browser tests used the installed Chrome channel. CI installs bundled Chromium.
- Historical credential revocation, real SMS/payment providers, production load, live public hosting and a team-approved license remain unverified. See SECURITY.md and provenance.md.
- Remote GitHub Actions results are recorded by the pull request checks; local passing checks alone do not establish a remote run succeeded.

Screens in `docs/screenshots` contain synthetic account data captured from the running application. The passenger map images use actual OSM tiles captured in a normal browser session. Automated map tests substitute labelled synthetic tiles and save their captures only in ignored `artifacts/screenshots`; no test pans or zooms against the public tile server. See [map coverage and attribution](map.md).
