# Verification — 18 October 2026

Local implementation is ready for owner setup and deployment preparation. Production deployment and physical iPhone installation are not yet accepted. No VPS was accessed.

## Automated evidence

- **22 tests, 7 files:** SQLite migrations/reopen, private authentication and credential reset revocation, Amsterdam Monday 03:00 boundaries including both DST directions and year crossover, programming/archive/weekly availability, session snapshots/transitions/modifications, pause/rest accounting, retries/version conflicts, historical corrections/metrics and disk backup integrity.
- **6 Playwright cases:** complete author/train/recover/edit/progress flow and protected endpoint checks in Chromium and mobile WebKit. Includes persisted drafts across reload, rest/pause recovery, offline retry, committed-write/lost-response retry, failed state GET during workout start, competing commands (200/409), abandonment and logout. No duplicate completed set/rest after replay. Custom Auctus selectors also cover keyboard open/select/Escape/focus return, create-and-select in templates and active workouts, failed creation/cancel preserving unsaved template edits, persisted set types, and 320–1440px menu/dialog bounds.
- Dashboard overflow assertions at 320, 768, 1024 and 1440 pixels. Desktop and mobile dashboard/progress/active-workout screenshots inspected. Screenshots generated under ignored `test-results/`.
- TypeScript, ESLint and production build pass. Docker build repeats unit/integration checks, typecheck, lint and production build on Linux arm64.
- `node scripts/verify-container.mjs` checks the actual production image with disposable containers and volume: private login, program/template authoring, set result/rest creation, application restart, identical recovered workout, online backup/integrity checks and a fresh application instance using the restored database. It cleans up its own temporary containers/volume.

All test credentials are explicitly disposable and scoped to temporary test databases. The real local database contains no seeded workout data or owner password.

## Review and corrections

Independent review covered authentication/API boundaries, command receipts, scheduling, session transitions, timing and historical editing. Addressed findings:

1. Successful mutation now returns authoritative application state, so a failed follow-up GET cannot advance into an empty workout view.
2. Completing an exercise leaves its final-set rest open until next exercise/set, manual end or workout termination.
3. Skipped, unstarted sets retain null start timestamps when notes are corrected. Each nonnull timestamp is independently validated against workout bounds, including skipped-set finishes; invalid edits roll back.

Additional regression coverage protects archived-program assignment history and database foreign keys. Command IDs reconcile uncertain writes; optimistic results are not shown as persisted.

## Dependency audit

`pnpm audit --prod` reports no high or critical advisories and one moderate advisory, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), in esbuild 0.18.20 through Better Auth's optional drizzle-kit dependency graph. It concerns esbuild's development HTTP server; Auctus does not launch that server. The app uses reviewed SQL migrations rather than drizzle-kit generation. This is a retained tooling dependency issue, not a claim of a clean dependency audit; recheck/update the graph before future releases.

## Outstanding acceptance

- User runs `pnpm run owner` privately to establish personal credentials.
- Real iPhone Safari/home-screen install, safe areas, suspend/resume, foreground sound and supported vibration. WebKit emulation is not physical iOS proof.
- VPS OS/resources/architecture, existing proxy, DNS/subdomain, access and backup destination; then HTTPS/cookies, firewall, startup, deployment restart and off-host restore checks.
- Offline logging is deliberately excluded. The app requires connectivity to confirm writes and retains one uncertain command for manual retry. Local draft storage and recovery are not a replacement for server backups.
- History is currently loaded for the single owner's dataset in one state response. Introduce pagination if real history size warrants it; no large-history performance benchmark is claimed.
