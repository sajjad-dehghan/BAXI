# BAXI frontend

`src/app` composes the application shell; `src/features` groups screens by user task; `src/shared` holds reusable UI, maps and client utilities. `public` contains only public PWA assets.

Run from the **repository root**; the root npm manifest and lockfile are the single dependency/install entry point:

```sh
npm ci
npm run dev
```

Keep the API on port `8000`; Vite proxies `/api` in development and preview. `npm run build` performs strict TypeScript checks, writes `frontend/dist` and generates the public service worker. `npm run test:e2e` selects `frontend/playwright.config.ts`, with diagnostics under `artifacts/test-results`.

The browser and API consume the same boundary from `shared/geo/tehran-area.json`. Do not place account records or private documents in `public`, the offline cache or browser storage.

[Full setup](../README.md#develop-locally) · [Structure and placement rules](../docs/repository-structure.md) · [Map sources](../docs/map.md)
