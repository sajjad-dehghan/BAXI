# Security and private data

This repository's supported runtime is a **local educational demo**. `compose.yaml` binds the web app and development MySQL port to `127.0.0.1`; API and document storage are internal. Its public sample credentials and OTP display must not be used for an internet-facing service.

## Current controls

- Runtime configuration comes from environment variables or an ignored `.env`. No historical server or credential is used. Example passwords are explicitly local and synthetic.
- The application database account has CRUD privileges on the two BAXI schemas only. It cannot create schemas or enable global event scheduling.
- Staff passwords use salted scrypt hashes and constant-time comparison; plaintext fallback is rejected.
- OTPs have six cryptographically generated digits, two-minute expiry, five verification attempts, a 30-second resend cooldown and single use. This demo returns them on screen; it provides no proof of real phone ownership.
- Session tokens are opaque, server-held, HttpOnly and SameSite=Strict, with a 12-hour lifetime. Production HTTPS requires `BAXI_COOKIE_SECURE=true` and an explicit exact-origin allowlist.
- Mutations require the application's custom header and reject unapproved browser origins. There is no permissive CORS configuration. Role and record ownership checks happen on the server.
- Identity/vehicle documents require authentication, are confined to designated folders, use private/no-store responses, and are never included in the public PWA cache. Uploaded formats are restricted to PNG/JPEG/PDF, with header and 10 MB size checks and random filenames. Content scanning, retention and real identity verification are not implemented.
- The service worker caches only public shell resources; API responses use `Cache-Control: no-store`. Browser storage does not contain account/session records.
- Database writes use parameters and explicit transactions. Completion and wallet retries cannot settle twice through the supported API.

## Historical exposure remains unresolved

The original Git history contains hardcoded database credentials, a Neshan key and a sample spreadsheet with personal-looking records. They were removed from the current source tree; the old desktop code remains recoverable through Git history. We did not contact the old server, test the old secrets or reuse them.

The owner could not verify whether those credentials were revoked or whether the old services still exist. **Removing the current files does not revoke credentials or remove copies from history, forks or clones.** Rotation/deletion must be done through the original provider accounts. History rewriting should follow rotation and contributor coordination; it has not been performed in this reconstruction.

Follow GitHub's [guidance on removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Do not include old values, identity documents or personal records in an issue or pull request.

## Reporting

For a vulnerability, contact the repository maintainer privately using an available GitHub contact or private security advisory. Do not post live credentials or private documents in public issues. No response SLA or production security certification is claimed.


## External secret-scanner check

GitGuardian's PR check flagged three generic-password occurrences in `.github/workflows/ci.yml` in reconstruction commit `9948929`. These are the explicitly disposable MySQL service/application passwords used solely by the isolated GitHub Actions job; they are not credentials for a retained service. The scanner has not been disabled or broadly suppressed, and the historical-exposure concern above is separate. The external incident remains for maintainer classification in GitGuardian; passing build/tests does not clear that check.

Public-place search sends only explicitly submitted queries to the configured geocoder. Avoid personal or confidential information; see [map.md](docs/map.md) for provider, caching and capacity details. Private API responses and trip records remain excluded from the PWA cache.
