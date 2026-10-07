# Provenance and feature boundaries

## Original university work

The existing README credited **Navid, Sajad and Arsham**, the **db4022 database course**, and **Bu-Ali Sina University**. This reconstruction preserves that credit. Individual ownership of design, code or database work was not established; no split of contributions, grade, adoption or commercial outcome has been invented.

The original implementation was a PyQt6 desktop application with phone-sized windows and a separate staff application. Its Qt Designer files, database design materials and UI screenshots are preserved under `docs/legacy`. The full original implementation remains recoverable from Git history, with baseline `8a0f05f`.

Historical design references from the original README:

- [User-app Figma source](https://www.figma.com/file/VVgkoPjr2XQsAXT3FawZph/BAXI?type=design&node-id=149%3A350&mode=design)
- [Staff-app Figma source](https://www.figma.com/file/f16EVeUFA5VmUyYbdSXhBd/BAXI_Admin?type=design&node-id=0%3A1&mode=design)

Those links are preserved references, not a claim that their current contents or accessibility were verified.

## Later reconstruction

The owner authorized a complete rebuild, minimal redesign and conversion to PWA in October 2026. The active UI, application services, API, schema, synthetic fixtures, tests and setup documentation were rebuilt with AI assistance. The new work should be presented separately from the original undergraduate artifact in a portfolio or résumé.

Design choices: Persian RTL first, locally bundled Vazirmatn, one restrained purple accent, light surfaces, simple forms, explicit service selection, mobile bottom navigation and desktop side navigation. The current UI uses React components and CSS rather than the archived screen images. Screenshots in `docs/screenshots` come from the actual running app with synthetic data.

## Current scope

The active demo implements authentication/registration, four-service quotation and requests, eligible nearby dispatch, approval/rejection, trip lifecycle and settlement, history and rating, demo wallet transfers, staff creation and 20 reports. The frontend operates on persisted API data, not hardcoded journey lists.

These integrations are deliberately explicit future work:

- SMS delivery and genuine phone ownership verification.
- Online map tiles, address search, road routing, traffic and ETA. The route graphic is schematic and coordinate inputs remain available.
- Real payment gateway, bank withdrawals, insurance and identity-document verification.
- Push notifications, background location and multi-instance real-time dispatch.
- Shared production session storage, document scanning/retention, account recovery and production operations.
- Public workflows for every auxiliary legacy table (addresses, referrals, complaints/compensation).

Turning off demo mode blocks fake OTP and wallet activity; it is not a production-readiness switch. The current new schema is for an empty local database and does not import old personal data.

## Licensing

The original repository had no verified project-wide license. The owner did not supply a license approved by the original team. This rebuild therefore does not assign one to the team's historical code/assets. Choose a license after confirming rights with contributors. Third-party software and fonts retain their own licenses; dependency metadata is available through pip/npm and package lock files.
