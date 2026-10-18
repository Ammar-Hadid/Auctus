# Auctus implementation proposal

Status: approved October 18, 2026. Implementation authorized. Dumbbell loads are per dumbbell; unilateral repetitions are per side. VPS details deferred by user.

## Environment inspected

- Repository: `Ammar-Hadid/Auctus`, clean `main` tracking `origin/main`, initial commit `3ddaa8c`.
- Only tracked file: README.md. No application, migrations, tests, or repository/ancestor AGENTS.md instructions found.
- Local machine: macOS arm64; Node 25.9.0, npm 11.12.1, pnpm 11.25.0, Python 3.14.6.
- Docker Engine 29.2.1 is reachable; Compose v5.0.2 is installed.
- VPS operating system, architecture, resources, proxy, storage, DNS, access method, and backup destination remain unknown. No VPS access attempted.
- Recommend a project-pinned Node 24 LTS runtime rather than changing the machine-wide Node installation. Exact compatible stable dependencies must be resolved and locked after approval; avoid release candidates.

## Stack comparison and recommendation

| Candidate | Strengths for Auctus | Costs and limits |
| --- | --- | --- |
| Next.js + React + TypeScript + SQLite/Drizzle | One language and deployment; large UI ecosystem; straightforward relational persistence; official PWA and self-hosting guidance | Must explicitly prevent stale private/session data caching; native SQLite driver must be built for the target architecture; single-host database |
| SvelteKit + TypeScript + SQLite/Drizzle | Compact reactive UI; integrated server routes and service worker support; standalone Node adapter | Smaller component ecosystem; different frontend conventions; does not reduce domain, timing, or persistence complexity |
| Next.js + TypeScript + PostgreSQL/Drizzle | Same UI approach with row locking and more write concurrency; useful if a managed private Postgres service already exists | Additional service, credentials, maintenance, backup and startup coordination for a one-user app |

Recommendation: Next.js App Router, React, strict TypeScript, SQLite, Drizzle ORM/Kit, better-sqlite3, Zod, Better Auth, Tailwind CSS, accessible Radix primitives where needed, Lucide icons, Temporal polyfill, Vitest and Playwright. Use supported stable versions pinned by lockfile. No Redis, queue, separate API deployment, or external database service is required for this scope.

SQLite is a deliberate production choice for one user and one application instance on local persistent VPS storage. Use PostgreSQL instead if infrastructure discovery reveals shared/network storage, multiple application hosts, or a preference for an existing managed database. That change must be explicit; an ORM does not make engine migration automatic.

## Architecture

Browser/PWA -> HTTPS reverse proxy -> one Node application -> SQLite on persistent local disk.

Within the application:

- Responsive routes and client controls render server-confirmed records.
- Authenticated HTTP command handlers validate inputs and call a server-only domain service layer.
- The domain layer owns state transitions, transaction boundaries, time calculations, and invariants; UI components cannot bypass it.
- Database queries provide history, availability and derived statistics. Private responses are not served from a stale framework/service-worker cache.
- A small PWA shell caches versioned public assets and an offline explanation; authenticated data and mutation responses remain network-only initially.

Authentication: one pre-provisioned account, no public registration, password hashing and database-backed cookie sessions through Better Auth. Bootstrap and password recovery use a local operator command with secret-safe input. Require secure HttpOnly SameSite cookies in production, trusted-origin/CSRF protection, rate-limited login, expiry/revocation, and authentication on every private read/write. Test auth adapter transaction support with the selected stable driver versions during foundation work. No custom cryptography or SMTP dependency for MVP.

UI: dark neutral surfaces, restrained accent color, high-contrast tabular numbers, 44px-or-larger primary touch controls, mobile bottom navigation, persistent workout recovery entry, and reduced-motion support. Actual result entry must distinguish targets from confirmed actuals. Reorder controls must work without drag-and-drop. Use inline confirmations where practical, and explicit loading, empty, unsaved, conflict, and failure states.

## Database outline

All domain rows have durable IDs. Store instants as UTC epoch milliseconds, durations as integer milliseconds, weights as integer grams exposed as kg, repetitions as integers, and ordered children with explicit positions. Foreign keys and check constraints are enabled. Targets and actuals are separate columns; null actual means unrecorded, never zero by default.

| Area | Tables and purpose |
| --- | --- |
| Access | Auth library user/account/session tables plus singleton application settings |
| Library | Exercise: stable identity, current name/details, archive timestamp |
| Programming | Program -> WorkoutTemplate -> TemplateExercise -> TemplateSet, with order, targets, type, planned rest |
| Calendar | TrainingWeek with Amsterdam Monday date and UTC start/end; WeeklyAssignment linking week and template, availability metadata and label snapshot |
| Execution | WorkoutSession -> ExerciseSession -> SetSession with state, ordering, timestamps, notes and copied prescription/name fields |
| Timing | WorkoutPause intervals and RestPeriod linked to workout and preceding set, with planned duration, start/end and end reason |
| Reliability | MutationReceipt keyed by actor/request ID, payload fingerprint and result reference; session version for stale-write detection |

Create the complete workout snapshot transactionally at start, including names, ordering, types, targets and planned rests. Preserve source IDs for progression queries, but never read mutable template values as historical prescription. Archive referenced programs/templates/exercises instead of cascading deletion into history. Removing session children with recorded activity marks them removed/skipped while preserving results; only untouched planned children may be physically removed.

WeeklyAssignment is distinct from an attempt: abandoned attempts do not complete an assignment, and any approved repeats link to the same assignment. Assignment completion is derived from eligible completed sessions. Weekly assignment generation is idempotent with a unique (week, template) key. History rows are never reset at rollover. Capture scheduling eligibility changes with effective dates if historical unvisited weeks must be reconstructed; do not infer past schedules from today's program alone.

Use reviewed SQL migrations, WAL, foreign_keys=ON, synchronous=FULL, a bounded busy timeout, short write transactions and no network calls inside transactions. Enforce at most one active exercise with a partial unique index, and enforce one active set and one open rest per workout. Cross-table requirements (including no active set during rest) are checked under the same write transaction. Use expected session versions and conditional state updates. Duplicate request IDs return the previous result; reuse with a different payload is rejected. A lost response can be reconciled by retrying the same command ID.

## Approved product rules

1. One selected program supplies weekly assignments. One unfinished workout globally; resume or abandon it before starting another. Other programs remain editable and archived programs retain history.
2. Each template satisfies its weekly assignment once; an explicit Repeat action may create extra sessions without increasing the number of distinct assignments completed. Repeats approved.
3. A workout crossing Monday 03:00 stays attached to its original week and remains recoverable. It does not auto-abandon, auto-complete, move weeks, or count twice. New-week assignments become available, subject to the unfinished-workout rule.
4. Additions/program switches take effect for future starts in the current week after an explicit apply action. Completed assignments and started snapshots remain intact; removed unstarted assignments are retained as withdrawn. Historical scheduling metadata remains accessible.
5. Workout: active <-> paused -> completed/abandoned. Exercise: pending -> active <-> paused -> completed/skipped. Set: pending -> active <-> paused -> completed/skipped. Terminal result corrections use a separate edit operation, not a second completion.
6. Pausing a workout pauses its active exercise/set and freezes active-duration/countdown accounting. Persist pause intervals; resume restores the same child activity. Switching exercises requires finishing/skipping an active set first, then explicitly suspending the old exercise and starting/resuming the selected one atomically. No automatic set completion.
7. Rest starts on completion of a set while the workout remains active, including a final set. It ends on next-set start, manual end, explicit exercise switch, workout completion or abandonment. Exercise switching closes rest with an interruption reason. Workout pause suspends rest rather than creating another rest period. Never open rest for historical edits or skipped sets.
8. Display actual rest as elapsed time excluding explicit workout pauses, while retaining wall-clock start/end and showing pause/wall duration in detail. Going into the background is not a pause. Countdown may pass zero into overtime; it never automatically starts a set. Approved.
9. Completing a workout with unresolved items requires explicit confirmation to mark those items skipped; active sets must first be completed or skipped. Abandoning closes live timers and preserves completed results and unfinished activity. Historical edits validate timestamps, pause/rest overlap and nonnegative durations transactionally; they do not restart live activity.
10. Proposed statistics: weekly cards count completed workouts and their completed sets, attributed to their assigned training week. Volume is sum(actual kg * actual reps), includes warm-ups, and excludes skipped sets and incomplete/abandoned workouts. Exercise records exclude warm-ups and consider completed sets in completed workouts. Heaviest load is measured; estimated 1RM is clearly labelled Epley, weight for one rep and weight*(1+reps/30) for 2–10 reps. Bodyweight-only work records reps with zero external-load volume. Dumbbell weights are per dumbbell and unilateral reps per side. Volume uses the entered load and reps without implicit doubling; label this convention in settings and statistics. Partial abandoned work remains visible in history.
11. MVP is online-first. No automatic offline command queue. Local recovery drafts may preserve inputs and request IDs but must be labelled unsaved until server confirmation. Auth expiry and network errors preserve the draft, allow re-authentication/retry and reconcile persisted state before advancing.

## Time and recovery design

Compute week bounds on the server with an IANA Europe/Amsterdam zoned calendar. Construct the local Monday 03:00 boundary and compare the current instant; if earlier, use the previous calendar Monday. Derive the next boundary by a calendar week in that timezone, never by adding 168 UTC hours. Persist start/end UTC instants and the local Monday date. Read-time lazy generation means no cron is needed for correctness. After inactivity, return the server's current week and session state.

Use injected server clocks for tests. Persist starts, ends and pauses in the same transaction as the state change. On load/focus, fetch authoritative state and server time. Between syncs, use monotonic browser elapsed time to render countdowns. After sleep/background/clock changes, reconcile with the server; if offline, label timing as estimated and mutations as unsaved. Intervals only repaint the display.

Sound is enabled through a user gesture and vibration feature detection is opportunistic. No reliable iPhone background alarm promise. Validate installation, standalone behavior, safe areas, audio and suspend/resume on a real iPhone; Playwright WebKit is useful but not equivalent to physical iOS Safari.

## Delivery sequence and acceptance gates

Tasks are tracked in tasks/todo.md. Keep the user's milestones, but implement rest persistence with the session engine so data semantics are not retrofitted later.

- M0: inspect, research, propose architecture and obtain decisions. Approved by user; VPS facts still pending.
- M1: pinned runtime/build, migrated disk database, one-user login, responsive shell and install manifest. Gate: authenticated CRUD persists across process restart; unauthorized access is blocked.
- M2: library, program/template editing and ordering, weekly availability. Gate: create an arbitrary program entirely through UI; calendar/DST tests and archive preservation pass.
- M3: transactional session snapshots, lifecycle commands, editing and recovery, initial rest records. Gate: a real workout can be started, logged, paused, resumed and completed; refresh/retry/concurrency tests pass.
- M4: complete rest controls, countdown/overtime, interruption semantics and best-effort notifications. Gate: persisted timing survives reload and background restoration with deterministic tests.
- M5: editable history, weekly statistics, previous performance and exercise records. Gate: historical edits change query results correctly, with sensible empty states.
- M6: complete browser smoke flows, responsive/accessibility polish, security review, production container, migration/backup/restore procedures and VPS deployment verification.

After each milestone: run relevant tests, typecheck/lint and production build, fix regressions, create a focused tested commit and report working behavior and remaining work. No further routine milestone approval is required after the user's implementation approval. Use codex/ branches when implementation begins; do not force-push or rewrite unrelated history.

## Verification

- Pure tests: transition matrix, validation, pause intervals, rest/active duration calculations, volume and PR rules, training week boundaries.
- Calendar fixtures: Monday 02:59:59.999/03:00, March 29 and October 25, 2026 DST transitions, 167/169-hour weeks, year crossover, multiple server timezones, and crossing a boundary mid-session.
- Integration: real temporary disk SQLite with actual migrations, close/reopen persistence, FK/check constraints, rollback, unique active-child constraints, repeated request IDs, competing requests, stale versions, snapshot independence, history edits and archive behavior.
- Browser smoke: authenticate, author program/template, select arbitrary exercise, log set and rest, refresh, pause/resume, reorder/modify, finish, edit history, verify metrics, test disconnect/lost response and login expiry.
- Operational: production build boots against migrated persistent volume; restore backup into separate database and verify integrity/content; health check and restart; HTTPS/cookie/origin validation on final hostname.

## Deployment proposal, conditional on VPS facts

One non-root application container with a persistent local data mount behind the existing reverse proxy. Publish only a loopback/private application port. The SQLite database has no network port. Use the existing proxy; provide Caddy or nginx guidance only as appropriate to discovered infrastructure. Do not alter unrelated services.

Document environment variables (database path, canonical public origin, auth secret), secret provisioning, reproducible frozen-lockfile build, one-time owner bootstrap, migrations before startup, health checks, restart policy and recovery. Back up before migrations; do not assume an older binary can read a migrated database.

Use SQLite's online backup API for consistent backups of a live WAL database, with retention and an encrypted off-host copy at a user-selected destination. Never copy only the live main database file. Test restore with the app stopped or into a separate target. Document application rollback separately from database restore and its potential loss of post-backup writes.

Need from user: OS/version, CPU architecture, RAM/free storage, Docker/Compose status, existing proxy/ports/services, subdomain and DNS control/status, authorized SSH host alias/access method, and backup destination. Do not paste passwords or private keys into chat.

## Feasibility and risks

October 18 target: the persistent authenticated programming-to-workout-to-history path, core state/timing tests, basic dashboard and installable PWA foundation. This is a target for useful functionality, not a declaration that all requested acceptance criteria fit in the remaining evening.

October 19 target: finish remaining required editing/statistics/error paths, production verification, real-device checks and deployment if access/DNS/infrastructure are ready. Exhaustive iOS behavior checks, VPS surprises, authentication/driver compatibility or failures in concurrency/history-edit tests can extend delivery. Do not silently remove required features or weaken integrity/testing to claim completion. Offline-first sync, guaranteed background alerts and AI programming are outside this MVP.

## Primary sources consulted

- Next.js PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- SvelteKit Node adapter: https://svelte.dev/docs/kit/adapter-node
- SvelteKit service workers: https://svelte.dev/docs/kit/$app-service-worker
- SQLite appropriate uses: https://www.sqlite.org/whentouse.html
- SQLite WAL: https://www.sqlite.org/wal.html
- SQLite online backup: https://www.sqlite.org/backup.html
- PostgreSQL locking: https://www.postgresql.org/docs/current/explicit-locking.html
- Drizzle SQLite: https://orm.drizzle.team/docs/sqlite/get-started-sqlite
- Better Auth adapter: https://better-auth.com/docs/adapters/drizzle
- Better Auth credentials: https://better-auth.com/docs/authentication/email-password
- Node release support: https://nodejs.org/en/about/previous-releases
- Temporal zoned calendar arithmetic: https://tc39.es/proposal-temporal/docs/zoneddatetime.html
- Playwright emulation: https://playwright.dev/docs/emulation
- Background behavior: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Vibration support: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- Audio restrictions: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

## Approved amendment — weight entry (18 October 2026)

Remove prescribed kilograms from templates. Templates retain exercise order, set count/type, reps and planned rest. At set start, snapshot the actual load from the latest completed, non-removed set for the same exercise identity (including current-workout results and completed sets in abandoned workouts). Do not match by set number or prescribe a progression. No prior result means an empty weight field; zero is a valid recorded load. Local edits, including clearing the field, survive refresh and take precedence over the prefill. Only completion writes actual results. Legacy session load prescriptions remain archived in the database; existing actual results and training statistics are unchanged.

## Approved amendment — rep ranges (18 October 2026)

Replace the single planned rep count with minimum and maximum reps per template set and session snapshot. Both are integers from 0–1000, with maximum at least minimum; equal bounds express an exact target. Migrate existing targets to equal bounds. Pending session prescriptions can be edited independently of templates. Training and history show the planned range, while completion and corrections record the exact reps performed, including results outside the range.
