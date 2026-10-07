# Repository structure

Run development, verification and Compose commands from the repository root. This is one application with two runtimes, not a collection of independently published packages. Root `package.json` / `package-lock.json` provide one frontend dependency graph; root `requirements*.txt` and `pyproject.toml` configure Python dependencies and checks.

## Where code belongs

| Directory | Responsibility |
| --- | --- |
| `backend/baxi/api.py` | HTTP validation, authentication/session identity, ownership, document responses and API endpoints. |
| `backend/baxi/application/` | Use cases, trip lifecycle, transaction boundaries, booking/settlement and report catalog. |
| `backend/baxi/core/` | Environment configuration, password/phone security and verification codes. |
| `backend/baxi/db/` | Parameterized queries, connections and context-local transactions. |
| `backend/baxi/geo/` | Coordinates, geocoding and Tehran coverage validation. |
| `backend/baxi/pricing/` | Deterministic fare engine and the versioned `policy.json`. |
| `backend/scripts/` | Explicit operational entry points: seed, API startup and monthly income. |
| `backend/tests/unit/` | Isolated domain, pricing, security and mocked-provider checks. |
| `backend/tests/integration/` | API and real MySQL checks using disposable synthetic records. |
| `frontend/src/app/` | Application entry, shell, role navigation and global styles. |
| `frontend/src/features/` | Auth, booking, driver, trips, wallet and staff screens, grouped by user task. |
| `frontend/src/shared/ui/` | Reusable controls, trip cards and fare details. |
| `frontend/src/shared/map/` | Lazy-loaded map, public-place search and browser coverage checks. |
| `frontend/src/shared/lib/` | API transport, shared types, formatting, draft helpers and error translation. |
| `frontend/public/` | Public install manifest and icons; never private documents. |
| `frontend/scripts/` | Icon and production service-worker generation. |
| `frontend/tests/e2e/` | Playwright journeys, responsive layouts, offline and accessibility checks. |
| `database/` | Fresh schema, restricted local grants and additive migrations. |
| `infra/` | Docker build definitions and nginx configuration. |
| `shared/geo/` | One versioned Tehran GeoJSON source consumed by Python and TypeScript. |
| `assets/demo-documents/` | Explicitly synthetic identity/vehicle fixtures. |
| `docs/` | Product and engineering evidence; `legacy/` retains original historical artifacts. |

The root Compose file is the local orchestration entry point. Docker build contexts remain the repository root, even though Dockerfiles live under `infra/docker/`. Frontend configuration lives beside its source; root npm scripts select it explicitly.

## Placement rules

- Python imports use the explicit `baxi` namespace. Start the API with `python -m uvicorn baxi.api:app --app-dir backend`; avoid restoring flat imports or relying on the current working directory to find modules.
- Keep HTTP concerns in the API, business transactions in application services, and SQL access in `db`. Pure pricing code must not depend on HTTP or the database.
- A frontend screen belongs to its feature; reusable maps, controls and transport belong to `shared`. The app shell composes features. Keep the current relative imports explicit rather than adding duplicate barrel exports or parallel source trees.
- Change the shared Tehran boundary once; do not maintain separate server/browser copies. Vite bundles it into browser code, while the API reads the same source file.
- Preserve `assets/demo-documents/...` and `data/uploads/...` document references: existing database rows store these relative paths. This structure change requires no database rewrite or migration.
- Preserve numbered SQL migrations and historical design artifacts. Put new evidence beside current documentation rather than modifying the archived originals.

## Generated and local files

`frontend/dist/`, `node_modules/`, `.venv/`, Python/tool caches and `artifacts/` are ignored. Playwright diagnostics go to `artifacts/test-results/`; browser evidence may be captured under `artifacts/screenshots/`. Reviewed documentation screenshots are deliberately committed under `docs/screenshots/`.

The local `.env`, database backups and private uploads are excluded from Git. Moving source does not reset Compose's named database/upload volumes. Old local build/cache directories were preserved under ignored `artifacts/previous-layout/`, rather than kept as a second source tree at the repository root.

## Checks

```sh
ruff check backend
ruff format --check backend
python -m pytest -q
npm run format:check
npm run build
npm run test:e2e
```

Set `BAXI_RUN_INTEGRATION=1` for the real MySQL/API suite against an initialized disposable local database. For browser checks against Compose, set `BAXI_BASE_URL=http://127.0.0.1:8080`. See the [README](../README.md) for installation and [verification record](verification.md) for evidence and limitations.
