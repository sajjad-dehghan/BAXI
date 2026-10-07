# Verification record — 2026-10-07

Evidence below describes the rebuilt local demo, not the historical Qt application's runtime or a public deployment.

## Passed locally

- After the repository organization, the full **101-case Python/MySQL/API suite** and **10 Playwright scenarios** were rerun successfully with the namespaced backend and feature-based frontend. Browser checks passed both through Vite production preview and through rebuilt Docker/nginx. Development HTML, module imports, shared GeoJSON loading and the `/api` proxy were smoke-checked; the monthly-income CLI also resolved correctly from outside the repository. Ruff, Prettier and strict production builds passed. Git object hashes confirmed unchanged SQL/migrations, pricing policy and shared city-boundary contents; existing volumes and stored document paths were retained. See [repository structure](repository-structure.md).
- **101 pytest cases** with real MySQL 8.4, first against the disposable review database and then against the Compose database using the restricted `baxi` user. Cases cover all four services, atomic rollback, competing acceptance, state/ownership, WOMEN and capacity restrictions, longitude/latitude cutoff, Tehran polygon inclusion and server rejection outside the city, explicit geocoder caching/rate limiting/error fallback/provider switching, passenger-selected payment enforcement and persisted place/assigned-vehicle metadata, wallet and cash settlement, insufficient funds, retry keys, rating, hashing, OTP expiry/rate limiting, private document access and all 20 reports.
- **10 Playwright scenarios** against the production build in Chrome, both via Vite preview and through Docker/nginx at `127.0.0.1:8080`: public/offline shell and manifest, passenger-to-driver journey and wallet/rating, driver onboarding and four-document approval, female/cargo quotation, all 20 staff reports, Tehran map selection/editing with keyboard and device-location checks, explicit place search without autocomplete, reversible cancellation, confirmed-draft retention during wallet navigation, visible primary actions, stale quote rejection and cash recovery from a wallet shortfall.
- Pricing checks cover minimum/base fares, every cargo weight boundary, half-up rounding, return journeys, owned/expiring/mismatched quotes, client-amount rejection, concurrent and post-expiry booking retries, immutable snapshots, changed commission versions, daily cleanup retention, legacy fare settlement and exact historical fractional-toman display. Browser expiry coverage confirms that fetching a changed price never automatically books.
- The wallet browser test commits a transfer, drops the first response, retries with the same key and verifies only one credit. This exercises an actual ambiguous network outcome rather than only clicking twice.
- Axe checks with WCAG 2 A/AA and 2.1 AA tags report zero detected violations on tested login, passenger service selection, payment/cancellation dialogs, assigned vehicle, receipt, driver-location dialog, wallet, registration, installation dialog and staff/report screens. This is automated coverage, not a complete manual accessibility certification.
- Layout overflow checks at **360, 390, 768 and 1440 CSS pixels**, plus visual inspection of captured login, passenger and staff screens. The map remains visible above a staged sheet on mobile, with a fixed primary action and independently scrollable sheet content. Compact service-selection sheets scroll their header/route with their contents, preventing wallet-shortfall notices from collapsing the usable pricing area. Primary action bounds are asserted at 360×640, 390×844, 768×900 and 1440×1000. Viewport changes are checked not to alter a searched coordinate.
- Offline reload opens the public shell, disables online actions, and confirms no `/api` URL appears in Cache Storage. Manifest icon resources load successfully.
- Chrome DevTools' installability check in a separate persistent test profile returns an empty error list. This checks browser installation prerequisites; it does not replace testing installation on a physical device.
- TypeScript strict build, unused-local checks, Ruff lint/format and Prettier checks pass. `npm audit` and `pip-audit --local` report zero known vulnerabilities in the installed dependency graphs at this check; pip was upgraded to 26.2.1 in the development environment and pinned for Docker/CI bootstrap. This is not a complete security audit.
- Pricing migration was applied after a local two-schema backup. On a separate isolated MySQL 8.4 instance, fresh initialization succeeded and upgrading the previous schema twice preserved a seeded legacy wallet of 1,234,567 IRR and fare of 123,457 IRR, without creating a fabricated pricing snapshot. The temporary test container and its anonymous volume were removed. The cost view uses booked snapshots when present, so settlement and reports also retain the booked amount after a direct legacy-detail edit.
- The additive booking-context migration was applied after a local backup, and reapplied successfully without changing existing data. Fresh-schema initialization is also exercised by CI.
- Docker builds the frontend and Python API, initializes MySQL, seeds synthetic accounts and passes API health checks. A separate Compose project with **fresh empty volumes** successfully bootstrapped all services and one completed journey in each of the four service categories. The temporary bootstrap project and volumes were removed afterward.

## Reproduce

See the README for the development environment. For the final Docker app:

```powershell
$env:BAXI_RUN_INTEGRATION='1'
python -m pytest -q
$env:BAXI_BASE_URL='http://127.0.0.1:8080'
npm run test:e2e
```

The Python suite reads the untracked `.env` and requires a local, seeded disposable MySQL database. Browser tests create synthetic driver accounts and journeys and replenish only the two dedicated demo passenger accounts through the normal demo API when needed; they should never run against real user data. `BAXI_BASE_URL` bypasses the automatic preview server and exercises an existing deployment. The API must permit that browser origin.

## Limits and observed warnings

- The test environment currently emits a Starlette TestClient deprecation warning for `httpx`; it does not fail the suite. A future migration to `httpx2` should be checked against FastAPI's supported test-client interface.
- Actual OS installation and physical iPhone/Android behavior were not manually tested. Chrome exercised service-worker registration/control, offline loading, manifest resources and keyboard installation help; Safari installation instructions are provided.
- The first official PyPI download failed because `files.pythonhosted.org` could not resolve in this environment. A locally selected reachable PyPI mirror completed the Python installation. The committed default index is official PyPI.
- Playwright's bundled Chromium download was blocked by the CDN's regional response; local browser tests used the installed Chrome channel. CI installs bundled Chromium.
- Historical credential revocation, real SMS/payment providers, production load, live public hosting and a team-approved license remain unverified. See SECURITY.md and provenance.md.
- GitGuardian flags three occurrences of synthetic disposable MySQL passwords in the initial CI workflow commit. The external check remains pending maintainer classification; it has not been suppressed. See SECURITY.md.
- Remote GitHub Actions results are recorded by the pull request checks; local passing checks alone do not establish a remote run succeeded.

Screens in `docs/screenshots` contain synthetic account data captured from the running application. The passenger map images use actual OSM tiles captured in a normal browser session. Automated map tests substitute labelled synthetic tiles and save their captures only in ignored `artifacts/screenshots`; no test pans or zooms against the public tile server. See [map coverage and attribution](map.md).

## Driver and HR visual documentation — 2026-10-07

The README now embeds 28 additional browser captures: 17 driver views and 11 HR/staff views, taken from the running local Docker app at desktop 1440 × 1000 and mobile 390 × 844 viewports. See the [screenshot index](screenshots/README.md) for the individual states, capture context and reproduction steps.

The driver walkthrough follows one persisted synthetic wallet-paid booking through offer, acceptance, start, completion and rating. The 43,000 toman fare, 8,600 commission and 34,400 net remain consistent; a subsequent 1,000 toman simulated withdrawal leaves 33,400. HR captures show private synthetic documents, pending/approved/rejected states, the recorded rejection reason in both staff and driver views, manager/reviewer navigation, report results, an empty report and the unsubmitted staff form. The pending review's filled rejection reason is also unsubmitted; it is distinct from the rejected account.

This documentation-only update does not change application code or database schema. Image files and README links were checked, and the GitHub-rendered gallery was inspected. The captures do not establish physical-device coverage or verification of every role/error combination.
