# Auctus execution checklist

Status: approved and in progress. VPS-specific work awaits infrastructure details.

Each task must pass its listed checks plus typecheck/lint and production build where applicable. File paths below are proposed touch points, not existing files. Split tasks further if implementation expands beyond a focused slice. At every milestone checkpoint, fix regressions, make a focused tested commit and report behavior verified and remaining work.

## M0 — Approval

- [x] Inspect repository and local tooling.
- [x] Compare suitable stacks against primary documentation.
- [x] Present proposed schema, invariants, milestones and deployment approach in tasks/plan.md.
- [x] Obtain stack approval and resolve product-rule questions.
- [x] Record approved decisions; user will supply VPS facts later.

## M1 — Foundation

### 1. Runtime and application skeleton (M; depends on M0)
- [ ] Pin compatible stable packages/runtime and establish a responsive app shell.
- [ ] Set up build, typecheck, lint and test commands; ignore secrets and runtime data.
Verification: fresh frozen install, production build and server boot.
Likely files: package.json, lockfile, framework/TypeScript config, app layout/styles; split scaffolding and UI if needed.

### 2. Persistent storage and migrations (M; depends on 1)
- [ ] Initialize database with foreign keys, WAL and durability settings; apply versioned migrations.
- [ ] Verify real disk records survive connection close and process restart.
Verification: migration, FK failure, transaction rollback and reopen integration tests.
Likely files: db connection, schema, migration config, initial SQL, integration test.

### 3. Private authentication (M; depends on 2)
- [ ] Bootstrap exactly one owner without public registration or committed credentials.
- [ ] Login/logout, expiry and password recovery protect all private reads/writes.
Verification: login smoke, unauthorized requests, cookie/origin checks, signup denial and auth persistence.
Likely files: auth config, route, login page, owner CLI, auth test; split recovery into a follow-up if needed.

### 4. PWA foundation (S; depends on 1, 3)
- [ ] Add manifest, icons, mobile metadata, standalone styling and safe offline fallback.
- [ ] Keep authenticated API responses out of service-worker cache.
Verification: manifest/icon inspection and production browser offline/logout checks.
Likely files: manifest, icons, metadata, service worker and fallback.

### M1 checkpoint
- [ ] Foundation checks pass; commit and report.

## M2 — Programming and weekly availability

### 5. Exercise library (M; depends on 2, 3)
- [ ] Persist exercise create/edit/search/archive through the UI.
- [ ] Retain identity and references after rename/archive.
Verification: library integration and UI smoke tests.
Likely files: library schema migration, service, handler, page, test.

### 6. Programs and templates (M; depends on 5)
- [ ] Persist program/template creation, editing, selection and archive.
- [ ] Safely preserve referenced historical rows.
Verification: CRUD and archive integration tests plus UI check.
Likely files: programming schema, service, handlers, pages, test; split program/template UI as needed.

### 7. Ordered prescriptions (M; depends on 6)
- [ ] Add/remove/reorder exercises and sets with type, reps, kg and planned rest.
- [ ] Persist and validate all fields and ordering transactionally.
Verification: round-trip editor test and invalid-input/ordering tests.
Likely files: prescription schema, validation, service, editor, test.

### 8. Training weeks (M; depends on approved calendar rules, 6)
- [ ] Compute Amsterdam Monday 03:00 bounds and idempotent weekly assignments.
- [ ] Implement selected-program changes, repeats and unvisited weeks according to approval.
Verification: before/at boundary, both DST directions, year crossover, repeated generation and scheduling changes.
Likely files: calendar module, scheduling schema, availability service, dashboard query, test.

### M2 checkpoint
- [ ] Arbitrary program authored in UI and weekly availability verified; commit and report.

## M3 — Session engine

### 9. Transactional snapshot creation (M; depends on 7, 8)
- [ ] Create complete independent session/exercise/set rows with prescription/name snapshots.
- [ ] Prevent duplicate starts and disallowed concurrent workouts.
Verification: template edits/archive cannot change snapshot; retry and parallel-start tests.
Likely files: execution schema migration, session service, command handler, integration test.

### 10. Workout transitions and recovery (M; depends on 9)
- [ ] Persist start/pause/resume/complete/abandon, durations, pauses and version checks.
- [ ] Recover after refresh/restart and reconcile lost responses by request ID.
Verification: transition matrix, pause tests, retry/conflict and reopen persistence tests.
Likely files: command receipt schema, domain transitions, command service, recovery UI, tests.

### 11. Exercise transitions (M; depends on 10)
- [ ] Start any exercise, suspend/switch/resume/complete/skip with deliberate transitions.
- [ ] Enforce one active exercise under competing requests.
Verification: unique-index/concurrency integration tests and arbitrary-order smoke flow.
Likely files: constraints migration, exercise service, handlers, exercise controls, tests.

### 12. Set workflow and basic rest records (M; depends on 11)
- [ ] Start/skip/complete sets with validated actuals, notes and timestamps separate from targets.
- [ ] Atomically close preceding rest/start set and complete set/create rest without overlap.
Verification: invalid transitions, duplicate completion, result validation and rest-invariant tests.
Likely files: rest schema, set service, validation, set controls, tests.

### 13. In-session modifications (M; depends on 12)
- [ ] Persist exercise/set add/remove/reorder and notes without losing recorded activity.
- [ ] Reject stale conflicting edits and preserve unsaved inputs on failure.
Verification: modification/reopen tests and mobile UI smoke.
Likely files: session editor service, handler, controls, draft handling, tests.

### M3 checkpoint
- [ ] Full basic workout persists through refresh, pause and completion; commit and report.

## M4 — Timing

### 14. Rest accounting and controls (M; depends on 12)
- [ ] Implement actual/planned rest, early end, interruptions, pause exclusion and wall duration.
- [ ] Prohibit overlapping rests and active-set/rest contradictions.
Verification: deterministic fake-clock tests and competing command integration tests.
Likely files: timing domain, rest service, handler, timing tests, integration tests.

### 15. Live timer restoration and notifications (M; depends on 14)
- [ ] Render countdown/overtime from timestamps and reconcile after visibility/clock changes.
- [ ] Add opt-in foreground audio and supported vibration with honest offline/background states.
Verification: reload/background/network browser tests and physical iPhone follow-up.
Likely files: timer hook, rest UI, audio utility, connection status, browser tests.

### M4 checkpoint
- [ ] Rest recovery and pause behavior pass; commit and report.

## M5 — History and statistics

### 16. History queries and details (M; depends on 13, 14)
- [ ] Show previous weeks/workouts with actuals, targets, notes, ordering, rest and skipped/abandoned activity.
- [ ] Show prior exercise performance during training.
Verification: fixture queries and populated/empty browser checks.
Likely files: history queries, history list/detail routes, previous-performance UI, tests.

### 17. Historical corrections (M; depends on 16)
- [ ] Edit historical results, dates/timing and notes with chronological validation.
- [ ] Preserve snapshots and recompute derived statistics without triggering live rest.
Verification: edited historical set changes metrics; invalid intervals roll back.
Likely files: edit validation, history service, handler, editor, tests.

### 18. Dashboard comparisons (M; depends on 8, 17)
- [ ] Query current/previous training week counts, actual volume, sets and active duration.
- [ ] Distinguish assignment completion from repeated workout count and handle empty weeks.
Verification: approved metric fixtures, abandoned/warm-up rules and historical-edit tests.
Likely files: metrics module, dashboard query, dashboard page, metric components, tests.

### 19. Progress and personal records (M; depends on 18)
- [ ] Display exercise progression and explicitly labelled measured/estimated records.
- [ ] Apply approved eligibility and load conventions with insufficient-data states.
Verification: PR fixtures and edited-history invalidation tests plus chart accessibility check.
Likely files: record calculations, progress query, route/chart, tests.

### M5 checkpoint
- [ ] History edits propagate to real dashboard/progress queries; commit and report.

## M6 — Quality and deployment

### 20. End-to-end and mobile acceptance (M; depends on 19)
- [ ] Verify full author/train/recover/edit/analyze flow, logout, error/conflict and disconnection paths.
- [ ] Check mobile/desktop layout, keyboard access, contrast, touch targets and reduced motion.
Verification: Playwright Chromium/WebKit, physical iPhone standalone and full test/build run.
Likely files: browser config, workout smoke, failure smoke, focused UI fixes.

### 21. Production packaging and recovery (M; depends on 20)
- [ ] Produce reproducible production image, private app binding, persistent data and migration procedure.
- [ ] Provide safe backup/restore and separate application/database recovery instructions.
Verification: container startup/restart, migration and restore drill, integrity/content assertions.
Likely files: Dockerfile, compose config, backup utility, deployment documentation, smoke script.

### 22. VPS-specific deployment (M; depends on 21 and infrastructure details/access)
- [ ] Adapt only Auctus configuration to existing proxy, DNS and host resources.
- [ ] Verify HTTPS, authentication, persistence, backup scheduling and real-device installation.
Verification: final hostname acceptance checklist, restart and backup checks.
Likely files: host-specific non-secret config examples, operations guide, verification checklist.

### M6 checkpoint
- [ ] All required definition-of-done paths demonstrated; production build and tests pass.
- [ ] Tested changes committed; working tree clean apart from explicitly documented local runtime files.
- [ ] Report deployed URL, operational steps, evidence and any remaining real limitations. Do not call MVP complete with required features outstanding.
