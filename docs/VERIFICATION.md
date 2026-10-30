# Verification record

Validated on 2026-10-30 using Node 24, Cloudflare's local workerd runtime via Wrangler 4.156, Vitest 5, Playwright 1.64, and Chromium 154 and 156. All application records used for testing were isolated, disposable data.

## Passing checks

- TypeScript strict type checking and the Vite production build.
- **13 unit and real SQLite storage tests:** input boundaries, venue requirements, credential hashing, persistence after object eviction, 24-hour expiry, timed experiences, simultaneous venue capacity, total island occupancy, checkout races, public event bounds and expiry, accidental key publication, request limits, and cleanup scheduling for invalid requests.
- **14 API and browser end-to-end tests:** full REST and human holidays; the official MCP SDK client; registered WebMCP callbacks; native Chromium WebMCP discovery and execution; live updates from an external agent to a human watcher; session restoration; key revocation; guest isolation; invalid, oversized and cross-origin requests; XSS rendering; mobile viewport limits; keyboard/focus behavior; automated WCAG AA checks; security headers, health, metadata and static assets.
- The native WebMCP test handles the input API difference between Chromium 154 (JSON strings) and 156 (objects). The application registers the same real action callbacks in both versions.
- `npm audit`: **zero reported vulnerabilities**, including development dependencies.
- Wrangler deployment dry run: Worker bundle, static assets, SQLite Durable Object namespace binding and initial migration package successfully. The deployment bundle contains no storage-test probes.
- Visual review at desktop and mobile sizes. Desktop preview loads both self-hosted fonts, has no page JavaScript errors, and has no horizontal overflow.

## Fixes made during review

- Corrected the guest-event insert and added complete lifecycle tests against real SQLite.
- Moved avatar animation onto the artwork so guest buttons remain stable and clickable.
- Corrected text/button contrast and preserved keyboard focus through modal dialogs.
- Replaced a full icon-library import with explicit icons; the frontend JavaScript bundle decreased from approximately 1.16 MB to 361 KB (113 KB compressed).
- Made credential lookup and the subsequent mutation contiguous, preventing concurrent checkout from reviving a stay.
- Enforced venue and island capacity atomically.
- Kept expired guests and events out of read responses, including before scheduled physical cleanup.
- Scheduled cleanup for rate-limit records created by invalid requests, even when no guest successfully checks in.
- Rejected stay-key-shaped strings in public text fields, redacted request query strings in Cloudflare logs, and kept credentials out of public responses.
- Made repeated breaks avoid duplicate events and made same-millisecond event ordering deterministic.
- Added a guest selector, private-key copying, stay restoration, and current-stay polling for agents controlled through another interface.
- Self-hosted licensed fonts and restricted all application resource requests to the same origin.

## External delivery status

The source repository is [thomasvt1/idlewild-resort](https://github.com/thomasvt1/idlewild-resort). GitHub-hosted verification and deployment jobs are configured in `.github/workflows/ci.yml`; current run results and downloadable browser-test reports are available under [Actions](https://github.com/thomasvt1/idlewild-resort/actions/workflows/ci.yml).

The [first GitHub-hosted verification run](https://github.com/thomasvt1/idlewild-resort/actions/runs/41064085519) passed the 13 unit/storage tests, 14 end-to-end tests, dependency audit, production build, and Cloudflare deployment dry run. Its deprecated action-runtime warning prompted an update to current SHA-pinned action releases and an explicit Ubuntu 24.04 runner. Production deployment is gated by `CLOUDFLARE_DEPLOY_ENABLED` and was skipped.

No Cloudflare account credentials are configured in this environment. A production deployment and checks against its public hostname remain unverified. The README documents the two required GitHub secrets, deployment enablement variable, first-deployment command, health check, and rollback constraints. Native WebMCP compatibility outside the tested Chromium versions remains dependent on the host browser's experimental API.

This record describes observed checks and the remaining access limits; it is not a production-security certification.
