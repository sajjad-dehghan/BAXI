# Changelog

## 2.0.0 — PWA reconstruction (2026-10-07)

- Replace the active Qt desktop applications with a responsive Persian RTL React PWA and a same-origin FastAPI backend.
- Introduce minimal passenger, driver, onboarding, wallet, history, staff-review and report screens; locally bundled fonts, app icons, install manifest and a public-only offline shell.
- Rebuild the database around explicit request IDs, service types, state transitions and constraints; preserve all four service categories and connect all 20 reports.
- Fix phone numbers losing trailing zeroes, invalid day/month handling, shared mutable trip state, swapped cargo/spatial coordinates, missing WOMEN restrictions and incorrect withdrawal ownership.
- Make booking, acceptance and settlement atomic; reject competing driver acceptance, repeat ratings and insufficient funds; prevent retrying the same transfer from charging twice.
- Hash staff passwords; move runtime settings out of source; add server-side sessions, ownership/role controls, document access checks and private-cache rules.
- Replace personal-looking samples with explicitly synthetic data and documents; remove import-time database write scripts and IDE metadata.
- Preserve original Qt/UI/EER artifacts under `docs/legacy` and retain original team attribution and Git history.
- Add Docker startup, unit/MySQL/API/browser regression tests, accessibility and offline checks, CI and architecture/security documentation.

Historical credential revocation and a team-approved license remain unverified. Real SMS, routing, payments and production operations are not represented as implemented.
