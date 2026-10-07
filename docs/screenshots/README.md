# Screenshot index

The [main README](../../README.md#the-driver-experience) embeds the current driver and HR galleries, including the additional states inside expandable sections. The [Persian guide](../README.fa.md#گالری-راننده-و-منابع-انسانی) links to both tours.

## Capture context

- Captured on **2026-10-07** from the running Docker app at `http://127.0.0.1:8080` using normal browser interactions.
- Desktop viewport: **1440 × 1000**. Mobile viewport: **390 × 844**. These are responsive browser captures, not physical phone screenshots.
- Files in `driver/` and `hr/` are native browser JPEG captures. Some are scrolled to the document decisions, expanded fare or wallet controls. They have not been composited or altered to invent interface states.
- All accounts, documents, salaries, journeys and wallet amounts are synthetic. Identity document previews explicitly say **BAXI · SYNTHETIC DOCUMENT**. The map uses actual OpenStreetMap tiles; see [attribution and usage](../map.md).
- Dedicated local demo accounts were created for pending/rejected/approved states and a funded passenger. These gallery accounts are not additional default seed accounts. A fresh installation will have different IDs, queue counts and report totals.
- Form screenshots are unsubmitted. A separate driver was actually approved, another was rejected with a reason, and one complete trip, rating and simulated withdrawal were persisted through the existing application flows.
- Coverage documents the main available states. It is not a claim that every validation error, service combination, offline state or physical device was tested.

## Driver coverage

### Registration and verification

- [Registration form](driver/registration-desktop.jpg): driver details, service, vehicle and passenger capacity; the page continues below the viewport.
- [Documents ready](driver/documents-ready-desktop.jpg): lower section of the same form, with four synthetic demo documents marked ready. No account was submitted.
- [Pending verification](driver/pending-mobile.jpg): travel requests unavailable until approval.
- [Rejected verification](driver/rejected-mobile.jpg): the rejection reason recorded by staff, also visible in the HR rejected-file capture.
- [Approved account](driver/account-mobile.jpg): verification badge, installation help and sign-out.

### Availability and dispatch

- [Off duty](driver/off-duty-mobile.jpg): start-work control and location reminder.
- [Location selection](driver/location-mobile.jpg): Tehran center-pin map and explicit confirmation, using the sample Azadi Square point without requesting device location.
- [Available, no request](driver/available-empty-desktop.jpg): on-duty status and empty matching-request state.
- [Nearby offer](driver/offer-desktop.jpg): full fare, commission, net earnings and acceptance action before assignment.

### One trip from acceptance to rating

- [Accepted](driver/accepted-mobile.jpg): assigned journey with start action.
- [In progress](driver/in-progress-mobile.jpg): passenger-selected wallet payment and completion/settlement action.
- [Expanded fare](driver/fare-details-mobile.jpg): entrance, distance, rounding adjustment and final amount.
- [Completed receipt](driver/receipt-mobile.jpg): fixed amounts retained in history, with passenger-rating form.
- [Rating saved](driver/rated-mobile.jpg): saved five-star rating replaces the form.

The route is **Azadi Square → Towhid Square**, with a fare of **43,000 toman**, commission of **8,600** and driver net of **34,400**. The offer, accepted trip, in-progress trip and receipt all refer to the same synthetic booking. Distance and fare use the existing straight-line model, not a street route.

### Wallet and recovery

- [Insufficient balance](driver/wallet-shortfall-mobile.jpg): a simulated withdrawal of 100,000 toman fails against 34,400 available.
- [Successful withdrawal, mobile](driver/wallet-mobile.jpg): a 1,000 toman simulated withdrawal leaves 33,400, with a recorded transaction.
- [The same wallet, desktop](driver/wallet-desktop.jpg): balance, withdrawal form and transaction in the desktop layout.

Trip earnings are visible in trip history; the wallet's recent-transaction section lists the demo withdrawal. No bank or payment provider was contacted.

## HR and staff coverage

- [Manager queue, desktop](hr/queue-desktop.jpg): pending list, three status filters, unselected document panel and manager navigation. Captured before the two demo decisions; the queue counts therefore differ from later images.
- [Document review, desktop](hr/document-review-desktop.jpg): four private synthetic documents and a draft rejection reason, scrolled to the approve/reject controls. The draft was not submitted for this pending driver.
- [Manager queue, mobile](hr/queue-mobile.jpg): status filters, queue and bottom navigation.
- [Document review, mobile](hr/decision-mobile.jpg): selected file, four previews, draft reason and both decision actions.
- [Approved file](hr/approval-recorded-desktop.jpg): saved approved status for the driver used in the journey above.
- [Rejected file](hr/rejection-review-desktop.jpg): saved rejected status and reason below the documents; a different synthetic driver from the pending review draft.
- [Reviewer role](hr/reviewer-desktop.jpg): review navigation without manager-only reports or staff creation. API authorization remains the access boundary.
- [Revenue report](hr/revenue-report-desktop.jpg): four services, journey counts and revenue in toman, including preserved historical fractions.
- [Department payroll report](hr/payroll-report-desktop.jpg): seeded synthetic employee count and salary total in toman.
- [Report empty state](hr/empty-report-desktop.jpg): no WOMEN eligibility violations in this local dataset. This report selects violations; it is not a list of all WOMEN journeys.
- [New colleague form](hr/new-colleague-desktop.jpg): manager-only form with salary, department, position, proficiency and education. No new staff account was submitted.

## Reproduce the states

1. Follow the [local setup](../../README.md#run-it-locally). Use two separate browser profiles for passenger and driver so their sessions do not replace one another.
2. Start with the seeded pending driver (`09120000070`) and HR manager (`9001`) or register separate synthetic drivers with the demo-document button. Keep different accounts for pending, approved and rejected states. Use the reviewer (`9002`) to inspect the limited navigation. Public demo staff credentials are in the main README.
3. In the HR view, select a pending file. Capture the four documents and decision controls. Approve one synthetic driver; reject another with a clearly synthetic reason. Sign in as each to view the corresponding result. The rejected driver's screen currently has no document resubmission flow.
4. For the approved driver, capture the initial off-duty state, location dialog and on-duty empty state **before** a passenger books. Keep both points inside Tehran and the passenger origin within 5 km of the reported driver location.
5. Fund the demo passenger wallet, confirm places and book with wallet payment. As the driver, capture the offer before accepting, then acceptance, start, expanded fare, completion, history and rating. The amount depends on the chosen points; compare the same booking throughout.
6. In the driver's wallet, try an amount above the available balance to capture recovery; then use a small valid simulated withdrawal and capture its record. Do not use any real identity or financial data.
7. As HR manager, choose reports 2, 15 and 13 for revenue, payroll and the compliance example. The last report is empty only when there are no violating rows. Open the new-colleague form without submitting it.
8. Use the viewport sizes above for comparable captures. Wait for data and document images to finish loading. Scroll to the relevant controls when necessary and restore the browser's normal viewport afterward.

## Existing passenger and historical captures

The main README's current passenger tour uses `pricing-breakdown-desktop.png`, `pricing-services-mobile.png` and `pricing-breakdown-mobile.png` from the upfront-pricing implementation.

Other images at this directory's root are retained as earlier design/verification artifacts. In particular, the older `driver-desktop.png` and `staff-desktop.png` are not the source for the current role galleries and may show an earlier currency or interface. Use the dated `driver/` and `hr/` sets above when presenting the current driver and staff experience.
