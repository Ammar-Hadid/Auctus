# Verification — 18 October 2026

Local implementation is ready for owner setup and deployment preparation. Production deployment and physical iPhone installation are not yet accepted. No VPS was accessed.

## Automated evidence

- **42 tests, 13 files:** SQLite migrations/reopen, private authentication and credential reset revocation, Amsterdam Monday 03:00 boundaries including both DST directions and year crossover, programming/archive/weekly availability, session snapshots/transitions/modifications, pause/rest accounting, retries/version conflicts, historical corrections/metrics and disk backup integrity.
- **6 Playwright cases:** complete author/train/recover/edit/progress flow and protected endpoint checks in Chromium and mobile WebKit. Includes persisted drafts across reload, rest/pause recovery, offline retry, committed-write/lost-response retry, failed state GET during workout start, competing commands (200/409), abandonment and logout. No duplicate completed set/rest after replay. Custom Auctus selectors also cover keyboard open/select/Escape/focus return, create-and-select in templates and active workouts, failed creation/cancel preserving unsaved template edits, persisted set types, and 320–1440px menu/dialog bounds.
- Dashboard overflow assertions at 320, 768, 1024 and 1440 pixels. Desktop and mobile dashboard/progress/active-workout screenshots inspected. Screenshots generated under ignored `test-results/`.
- TypeScript, ESLint and production build pass. Docker build repeats unit/integration checks, typecheck, lint and production build on Linux arm64.
- `node scripts/verify-container.mjs` checks the actual production image with disposable containers and volume: private login, program/template authoring, set result/rest creation, application restart, identical recovered workout, online backup/integrity checks and a fresh application instance using the restored database. It cleans up its own temporary containers/volume.

All test credentials are explicitly disposable and scoped to temporary test databases. The real local database contains no seeded workout data or owner password.

## Weight-entry amendment

Templates no longer contain planned kilograms. Regression coverage verifies first-use empty weight, individual template-set matching in the previous workout, independent 15/30/35 kg warm-up/working-set suggestions, stable identity after reordering and adding a warm-up, corrected and zero loads, skipped/removed exclusion, pause/reload recovery, editable and intentionally cleared browser drafts, and populated database migration preserving actual results and old session prescriptions. Browser tests verify the absence of template weight controls, independent warm-up/working-set suggestions, editable drafts after reload, and that a prefill is not saved as an actual result before completion. Migration coverage verifies legacy set linking and replacement of an active warm-up’s old working-set suggestion without changing recorded results. Invalid or duplicate template-set references roll back without losing templates.

## Rep-range amendment

Templates and pending session sets accept minimum and maximum reps. Validation rejects inverted, fractional and out-of-bounds ranges. Workout snapshots retain their original range after template edits, while actual results remain exact counts and may fall outside the plan. Existing exact targets migrate to equal bounds without changing completed results. Browser coverage checks 6–8 rep authoring, invalid-range feedback, session editing, history display, and template layout from 320–1440px.

## Exercise editor refinement

Document-icon saves persist workout changes and collapse the selected exercise only after server confirmation. Coverage includes required-name validation, rejected saves retaining edits, committed-write/lost-response retry without duplicate templates, reopening after reload, adding/reordering exercises with stable collapsed state, keyboard access, and 320–1440px bounds. Focus uses a single inset highlight, with an additional underline on primary buttons for keyboard visibility.

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

## Searchable exercise picker

Exercise pickers in templates and active workouts use an editable combobox with the shared Auctus menu styling. Browser coverage checks case-insensitive, trimmed name filtering, no matches, keyboard selection, Escape/Tab dismissal, clearing an old selection while typing, reset after adding, and query-prefilled creation. Creating an exercise restores input focus without reopening the menu over the Add action. Desktop and mobile screenshots and 320–1440px bounds checks cover placement.

Search-to-create uses the same menu and creation dialog in Library, templates, and active workouts. A nonblank name without an exact saved match offers **Add “name”**; exact matches ignore case and surrounding whitespace. Browser checks cover the dynamic label, prefilled name, cancel preserving the Library query, successful creation and filtering, and persistence after reload on desktop and mobile.

## Rest timer controls

Migration 0008 adds persisted countdown extensions and independent timer pause state. Unit coverage checks overlapping workout/timer pauses, refresh from stored state, invalid adjustments, versioned commands, idempotent extension retries, overtime extension, and closing a paused rest when the next set starts. Browser checks on Chromium and mobile WebKit cover pause/resume, +5s/+15s, persistence after reload, and the timer staying at the viewport top after scrolling. Actual rest and template prescriptions remain unchanged by countdown adjustments.

## Sound and background notifications

Audio unit checks cover three-tone playback, mute, persisted preference, and suspended/blocked contexts. Browser tests instrument real AudioContext oscillator starts for the Test sound gesture and timer expiry in desktop Chromium and mobile WebKit. Push tests use simulated senders (no external notifications) for deadline handling, extensions, pauses, deduplication, retry, expired endpoints, session revocation, and invalid endpoint rejection. The service worker is checked for visible notification presentation and click focus. Push API unauthenticated and cross-origin calls are rejected.

Actual speaker output, iPhone notification sound/haptics, and APNs delivery require physical-device testing at the future HTTPS deployment; those are not verified by headless tests. The current HTTP local instance intentionally does not offer active background notification enrollment.
