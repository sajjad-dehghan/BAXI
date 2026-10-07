# Changelog

## Versioned sample pricing — 2026-10-07

- Add base/minimum fares, cargo weight bands and half-up rounding; remove the unsupported demo insurance premium.
- Persist owned five-minute quotes and immutable booked fare, commission and driver net; enforce quote IDs and idempotent booking.
- Use stored net for wallet/cash settlement and income reports; preserve legacy fares and settlement rules through an additive migration.
- Display and enter money in tomans throughout the PWA, including exact fractional historical amounts, receipts and driver offers.
- Add expiry/reconfirmation, pricing breakdowns, daily unused-quote cleanup and a documented sample tariff policy.


## Map-first ride experience — 2026-10-07

- Replace the long booking form with sequential map confirmation and a fixed-action responsive sheet.
- Compare service prices, explicitly search public places, preserve the confirmed draft during wallet navigation, and select payment before requesting.
- Show assigned driver/vehicle identity, reversible cancellation, and an inline receipt/rating.
- Replace driver coordinate inputs with map/device selection.
- Add a non-destructive booking-context migration, geocoder policy controls and UX decision/evidence documentation.


## 2.0.0 — PWA reconstruction (2026-10-07)

- Replace the active Qt desktop applications with a responsive Persian RTL React PWA and a same-origin FastAPI backend.
- Introduce minimal passenger, driver, onboarding, wallet, history, staff-review and report screens; locally bundled fonts, app icons, install manifest and a public-only offline shell.
- Add interactive Tehran map booking: movable origin/destination pins, explicit confirmation, keyboard/device-location support and shared city-polygon validation in browser and API; show persisted points on active journeys.
- Rebuild the database around explicit request IDs, service types, state transitions and constraints; preserve all four service categories and connect all 20 reports.
- Fix phone numbers losing trailing zeroes, invalid day/month handling, shared mutable trip state, swapped cargo/spatial coordinates, missing WOMEN restrictions and incorrect withdrawal ownership.
- Make booking, acceptance and settlement atomic; reject competing driver acceptance, repeat ratings and insufficient funds; prevent retrying the same transfer from charging twice.
- Hash staff passwords; move runtime settings out of source; add server-side sessions, ownership/role controls, document access checks and private-cache rules.
- Replace personal-looking samples with explicitly synthetic data and documents; remove import-time database write scripts and IDE metadata.
- Preserve original Qt/UI/EER artifacts under `docs/legacy` and retain original team attribution and Git history.
- Add Docker startup, unit/MySQL/API/browser regression tests, accessibility and offline checks, CI and architecture/security documentation.

Historical credential revocation and a team-approved license remain unverified. Real SMS, routing, payments and production operations are not represented as implemented.
