# Verification — 18 October 2026

Deployed to https://auctus.ammarhadid.com on `nexo-vps` on 18 October 2026 with a fresh owner account and empty training database. Physical iPhone installation, sound/haptics and APNs delivery still require device acceptance.

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

- The VPS owner is provisioned. Other installations use `pnpm run owner` privately to establish their own credentials.
- Real iPhone Safari/home-screen install, safe areas, suspend/resume, foreground sound and supported vibration. WebKit emulation is not physical iOS proof.
- Off-host backup destination and failure alerting remain unconfigured. The current daily backups live on the same VPS; they do not protect against host loss.
- Offline logging is deliberately excluded. The app requires connectivity to confirm writes and retains one uncertain command for manual retry. Local draft storage and recovery are not a replacement for server backups.
- History is currently loaded for the signed-in account’s dataset in one state response. Introduce pagination if real history size warrants it; no large-history performance benchmark is claimed.

## Searchable exercise picker

Exercise pickers in templates and active workouts use an editable combobox with the shared Auctus menu styling. Browser coverage checks case-insensitive, trimmed name filtering, no matches, keyboard selection, Escape/Tab dismissal, clearing an old selection while typing, reset after adding, and query-prefilled creation. Creating an exercise restores input focus without reopening the menu over the Add action. Desktop and mobile screenshots and 320–1440px bounds checks cover placement.

Search-to-create uses the same menu and creation dialog in Library, templates, and active workouts. A nonblank name without an exact saved match offers **Add “name”**; exact matches ignore case and surrounding whitespace. Browser checks cover the dynamic label, prefilled name, cancel preserving the Library query, successful creation and filtering, and persistence after reload on desktop and mobile.

## Rest timer controls

Migration 0008 adds persisted countdown extensions and independent timer pause state. Unit coverage checks overlapping workout/timer pauses, refresh from stored state, invalid adjustments, versioned commands, idempotent extension retries, overtime extension, and closing a paused rest when the next set starts. Browser checks on Chromium and mobile WebKit cover pause/resume, +5s/+15s, persistence after reload, and the timer staying at the viewport top after scrolling. Actual rest and template prescriptions remain unchanged by countdown adjustments.

## Sound and background notifications

Audio unit checks cover three-tone playback, mute, persisted preference, and suspended/blocked contexts. Browser tests instrument real AudioContext oscillator starts for the Test sound gesture and timer expiry in desktop Chromium and mobile WebKit. Push tests use simulated senders (no external notifications) for deadline handling, extensions, pauses, deduplication, retry, expired endpoints, session revocation, and invalid endpoint rejection. The service worker is checked for visible notification presentation and click focus. Push API unauthenticated and cross-origin calls are rejected.

Actual speaker output, iPhone notification sound/haptics, and APNs delivery require physical-device testing at the live HTTPS deployment; those are not verified by headless tests. The separate HTTP local instance intentionally does not offer active background notification enrollment.

## VPS deployment acceptance

The Linux amd64 image passed all 42 tests, typecheck, lint and production build on the VPS. A disposable production-image drill on that host verified authenticated programming, set completion, live-rest persistence through restart, SQLite backup integrity and an identical recovered workout after restoring into a separate application instance. The drill containers and volume were removed; no synthetic workouts were written to the owner's production database.

The public domain serves this app's login, manifest and push-capable service worker. HTTP redirects to HTTPS, HSTS is present, private APIs reject unauthenticated reads, and the old API subdomain redirects to the new same-origin API. Live Chromium and mobile WebKit checks verify login rendering, no horizontal overflow or page errors, owner sign-in with Secure/HttpOnly/SameSite cookies, empty training state, Settings, configured public VAPID key and logout. Desktop push enrollment is available; physical Home Screen installation and OS permission still need the user. The production container was restarted successfully; it has no published host port, persists its database through a bind mount, and has initialized the HTTPS push scheduler.

Only the Auctus proxy blocks were replaced. Unrelated Docker containers kept their original IDs and remained running; the shared Caddy container was reloaded, not restarted. The old Auctus containers were removed after archiving source/config and validating BSON exports of seven MongoDB collections. Daily SQLite backups were installed and an initial backup verified. Retained legacy images and configuration provide a rollback path. See deployment.md for locations and remaining off-host backup work.

## Master-managed accounts and passkeys (19 October 2026)

Account migrations preserve existing results and associate all old training records, scheduling, settings and command receipts with the existing master. Tests exercise cross-account reads and writes, direct cross-owner database relationships, simultaneous active workouts, independent schedules, receipt reuse, master-only provisioning and password confirmation. Push tests verify that simultaneous rests only reach each account’s eligible sessions, including the master passkey gate. Passkey tests cover fresh enrollment, expired one-use challenges, existing-key requirements and session revocation.

The Chromium integration test uses a disposable virtual authenticator against a temporary database. It exercises initial registration, password-only denial across private APIs, master-only account creation, member isolation, rejected stale-account writes, sign-out, attempted key replacement with only a password, invalid authentication, and successful passkey sign-in. No virtual passkey is enrolled in the real local or production master accounts. Physical enrollment must be performed by the owner. Mobile WebKit still runs normal training and authorization tests; virtual WebAuthn testing uses Chromium CDP.

The account update passes 47 tests across 16 files, typecheck and lint. Browser suites run against separate temporary databases per browser so their combined sign-ins do not trip the production five-attempts-per-minute limiter: four Chromium tests and three mobile WebKit tests pass; the CDP-only passkey test is skipped on WebKit. Both actual local and VPS pre-update backups were migrated separately and compared row-for-row, including settings and command receipts; database and foreign-key integrity passed.

Live acceptance: image `auctus:d83aac7` passed a disposable Linux container restart and backup/restore drill. Both local and deployed test credentials were verified against their actual databases. Public HTTPS checks passed in desktop Chromium and mobile WebKit, with Secure/HttpOnly/SameSite cookies, empty member data, blocked administration/signup and successful logout. The real master password led to the mobile passkey setup screen; `/api/state`, `/api/command`, `/api/accounts` and `/api/push` were inaccessible before verification. The returned registration options require device user verification and the exact production relying-party ID. Physical enrollment remains the owner’s action.

## iPhone / 1Password passkey investigation — 19 October 2026

The master passkey exists, and the canonical relying-party origin is
`https://auctus.ammarhadid.com`. Recent iPhone password sessions have authentication
challenges but no completed passkey verification. The existing logs do not establish
why the device failed; this is not proof of a signature or database error.

Authentication now uses the discoverable saved-passkey chooser (`allowCredentials: []`),
matching the resident credentials required at registration. The server still binds the
returned credential to the password-authenticated account and verifies the signature,
origin, relying-party ID, one-use challenge, and user verification. No credential reset,
session bypass, schema change, or weaker verification is involved. The device call follows
a native fetch directly in the click handler for Safari compatibility. Errors identify
whether the failure occurred starting the request, on the device, or verifying the response.

References: [SimpleWebAuthn passkey guidance](https://simplewebauthn.dev/docs/advanced/passkeys/)
and [Safari browser quirks](https://simplewebauthn.dev/docs/advanced/browser-quirks).
The older Safari gesture restriction does not establish the cause on modern iOS.

Regression coverage includes real registration/authentication with a Chromium virtual
authenticator, rejection of another account's credential, and a simulated device
`NotAllowedError` with fresh retries in Chromium/mobile WebKit. Simulating the error tests
the recovery UI; it does not reproduce 1Password itself. Physical iPhone/1Password acceptance
remains required before calling the reported device issue resolved.

Deployed app commit `7fc0b70` to nexo-vps. Validation: 48 unit/integration tests,
TypeScript, ESLint, production build, 5 Chromium and 4 mobile WebKit browser cases
pass (the CDP authenticator case is Chromium-only). Public HTTPS browser smoke
confirmed Auctus renders, the existing test member can sign in, master passkey
endpoints reject that member with 403, and sign-out restores 401 for private state.
The server is healthy and still has the original single registered passkey. Other
service container IDs did not change. Pre-update online backup:
`/srv/backups/auctus/sqlite/auctus-2026-10-18T23-03-52Z.db`; rollback image:
`auctus:before-passkey-chooser-2026-10-19`.

Physical-device acceptance failed: the user reports `Device: NotAllowedError`
with the deployed chooser. The passkey is visible in 1Password on the iPhone,
AutoFill already uses All Accounts, and explicitly choosing Other options →
1Password → the Auctus passkey still fails. Repeating those setup instructions
is not the next diagnostic step. The failure is inside the device ceremony,
before a signed response is submitted for server verification; its underlying
cause remains unknown. Verification of the same saved key in a separate Mac
browser session is pending, while preserving the existing authenticated session.

The Mac retry also failed. The user's screenshot shows 1Password's own dialog:
“Passkey authentication failed / This passkey could not be used to sign in”,
followed by Auctus's device-stage `NotAllowedError`. This rules out an iPhone-only
failure but does not prove that the private key is corrupted. Read-only production
checks found one active verified Macintosh session and a decodable ES256/P-256
public key with 32-byte coordinates. No keys or sessions were reset.

The existing `/unlock?add=1` flow permits another credential only from an already
verified session. Expanded Chromium coverage confirms adding a second authenticator
with the original unavailable, retaining both registered keys, and a fresh password
plus backup-passkey login; the focused account test passes. The user was asked to
create a backup in Apple Passwords from the original authenticated Mac window to
test another provider. Physical registration/authentication acceptance is pending.

## Repeating rest alarm — 19 October 2026

Foreground rest completion now starts a looping clock-alarm buffer. Stop alarm acknowledges
that rest deadline without muting the next rest; pause, extension into the future, ending rest,
starting the next set and leaving the screen stop playback. Settings and the fixed rest panel
both offer the same repeating preview and a visible stop control. A pending audio-unlock request
cannot restart playback after mute. Background Web Push remains notification-based: native iOS
AlarmKit is required for reliable scheduled system alarms outside the web app.

Audio unit coverage checks waveform content, looping, dismissal/reload, extension re-arming,
cleanup, delayed unlock cancellation and blocked/suspended audio recovery. Browser coverage
uses real AudioBufferSource nodes to check expiry, playback beyond a full loop, explicit stop,
extension, pause/resume and next-set cleanup. The authentication suite runs with its own temporary
database/server to avoid exhausting the unchanged production sign-in limiter. The existing
keyboard-focus assertion now waits for the rendered style instead of reading it immediately.

Physical iPhone speaker output and background notification delivery still require device
acceptance; automated WebKit does not demonstrate native iOS background alarm capability.

Validation: 51 unit/integration tests, typecheck, lint and production build pass. All
six Chromium cases pass across the isolated runs (including a focused recheck of the
keyboard-style assertion); five mobile WebKit cases pass, with the Chromium-only virtual
passkey case skipped. Desktop and mobile screenshots confirm the alarm controls fit.

Live acceptance: image `auctus:7fe049a` is healthy on nexo-vps. Public HTTPS smoke checks
passed in Chromium and mobile WebKit using the existing test member: sign-in, Rest alerts,
real looping AudioBufferSource playback past a full cycle, explicit stop, sign-out and a
subsequent private-state 401. No training records were created by these smoke checks.
Unrelated service container IDs remained unchanged. Pre-update online backup:
`/srv/backups/auctus/sqlite/auctus-2026-10-18T23-50-45Z.db`; rollback image:
`auctus:before-looping-alarm-2026-10-19`. Local production server is also updated on port 3105.

## End rest dismisses the alarm — 19 October 2026

The workout timer no longer offers a separate Stop alarm button. End rest is its primary
action: it silences audio immediately and ends the rest period. Settings retains a stop
control only for its test preview, and its instructions now explain End rest.

Focused Chromium and mobile WebKit checks pass for repeating expiry audio, End rest,
absence of the separate stop button, and persistence after reload. The workout flow and
API authorization checks also pass in both browsers. Typecheck and lint pass. A stale
development build initially caused reload loops; restarting with a fresh development
cache resolved those test-server failures.

## Remove preview controls — 19 October 2026

Removed Test alarm, its preview stop control, and Test notification from the interface.
Enable sound now unlocks audio without playback. Explicit sound controls bypass the global
pointer/keyboard audio-unlock listener so its state change cannot turn an enable click into
mute before the click handler runs. Rest expiry still rings; End rest stops it.

Validation: 51 unit/integration tests, typecheck, lint and production builds pass. All six
focused Chromium/mobile WebKit alarm and workout checks pass, including silent enable,
expiry playback, End rest, reload and absence of preview buttons. Image `auctus:c8b5567`
is healthy on the VPS. Public HTTPS checks in both browsers confirm the updated copy,
absence of preview controls, silent enable/mute, sign-in and sign-out. Unrelated service
container IDs remain unchanged. Backup: `auctus-2026-10-19T00-08-44Z.db` in the standard
VPS SQLite backup directory. Rollback image: `auctus:before-remove-previews-2026-10-19`.

## Exercise and set hierarchy — 19 October 2026

Mobile exercises now occupy one full row each. Exercise rows have a filled surface,
square exercise/check icons, explicit status labels and recorded-set counts. Completed
exercises have a green-tinted surface, accent checkmark and Completed label. The selected
exercise has a distinct heading; its numbered sets sit in an indented Sets section with
quieter outlined cards. Selection exposes aria-current; Arial and workout actions are retained.

Validation used a disposable local fixture with completed, active and pending exercises,
including long names. Chromium and mobile WebKit checks covered 320, 390, 768, 1024 and
1440px layouts, full mobile row widths, no horizontal overflow, completion rendering,
keyboard selection, console errors and the existing workout/API flow. All six cases passed;
mobile and desktop screenshots were inspected. Typecheck, lint, production builds and the
51 Docker unit/integration tests pass. The fixture was not added to production data.

Image `auctus:879fced` is healthy on nexo-vps. Public HTTPS checks in Chromium/mobile
WebKit confirm the new stylesheet, member sign-in, sound controls and sign-out. Other service
container IDs remain unchanged. Backup: `auctus-2026-10-19T09-50-40Z.db` in the standard VPS
SQLite backup directory. Rollback image: `auctus:before-exercise-hierarchy-2026-10-19`.

### Border refinement

Resolved all three design-hook findings by removing the thick side borders on exercise/active
set cards and the accent bottom border on the rounded exercise heading. Completion icons,
labels, filled surfaces, selected-state outlines and full mobile rows remain. No ignores were
added; one Impeccable detector pass returned no findings. Desktop/mobile screenshots and
responsive checks passed, as did the standard Docker checks (51 tests, typecheck, lint, build).
Image `auctus:fc11352` is healthy. Public Chromium/mobile WebKit checks confirm the removed
border declarations in the served stylesheet, login, sound controls and logout. Backup:
`auctus-2026-10-19T09-54-30Z.db`; rollback: `auctus:before-border-refinement-2026-10-19`.

## Blue in-progress state — 19 October 2026

Added shared blue foreground, surface and secondary-text tokens. Active exercise rows,
the selected active exercise heading and active sets use a blue-tinted surface. Active
exercise icons use a filled play symbol; active sets explicitly say In progress. Completed
items retain green and pending items remain neutral. Borders remain thin, without side accents.

Validation: typecheck, lint and local production build pass. Disposable Chromium and mobile
WebKit fixtures confirmed active/completed colors, labels, keyboard selection, full mobile
exercise rows and no overflow at 320, 390, 768, 1024 and 1440px. Desktop/mobile screenshots
were inspected. Blue text contrast on its surface exceeds 8:1. One Impeccable detector pass
returned no findings; no suppressions were added. All 51 Docker tests, typecheck, lint and
production build pass.

Image `auctus:36ff43f` is healthy on the VPS. Public HTTPS Chromium/mobile WebKit checks
confirmed login, the new blue tokens and stylesheet rules, logout and protected API access.
Unrelated service containers remain unchanged. Backup: `auctus-2026-10-19T10-46-50Z.db`;
rollback image: `auctus:before-blue-progress-2026-10-19`. Local production server is also
running the update on port 3105. No production training data was changed.

## Paused and skipped feedback — 19 October 2026

Added shared orange paused and red skipped tokens, tinted surfaces and secondary text.
Workout, exercise, set, overview and history statuses now share explicit labels and icons:
play for in progress, pause for paused, check for completed, skip for skipped, and an empty
circle for not started. Paused rests turn orange, including when already overtime. Pausing
a workout displays an explanation and preserves the paused exercise as the default detail
selection. Completed set badges/surfaces are green; pending badges are neutral.

Validation: Chromium and mobile WebKit fixture checks cover all five activity states,
pause/resume, disabled results while paused, selection retention, independent rest pause,
skipped history and no overflow/full mobile rows at 320, 390, 768, 1024 and 1440px.
Desktop/mobile screenshots were inspected. Both full workout/API flows also pass (four
checks). Orange/red foreground and secondary-text contrast on their surfaces exceeds 8:1.
The Impeccable pass returned no findings; none were suppressed. Local build, lint/typecheck
and all 51 Docker tests plus the production build pass. Fixtures stayed in disposable databases.

Image `auctus:f09235a` is healthy. Public HTTPS Chromium/mobile WebKit login, served status
tokens/styles, logout and protected API checks pass. Unrelated service IDs remain unchanged.
Backup: `auctus-2026-10-19T10-55-56Z.db`; rollback:
`auctus:before-status-feedback-2026-10-19`. Local port 3105 also serves the update.

## Fixed notifications — 19 October 2026

All application error and toast messages now use a shared Radix Toast viewport fixed at the
bottom right, above the mobile navigation and safe-area inset. Messages stack, wrap and scroll
within a bounded viewport without shifting page/form content. Errors persist until dismissed;
success/info messages expire after six seconds, pausing dismissal on interaction. Saving,
offline and unconfirmed-write notices persist until resolved. Retry/discard controls remain
available. Inline history notes and workout state explanations remain document content.

The same viewport moves into an open exercise dialog's accessibility/focus boundary without
being constrained by the transformed dialog panel. The dialog now exposes the actual save
error rather than a duplicate generic message. Notification-settings failures use error tone.
Updated browser assertions for portal notifications and one stale exercise-row name selector.

Validation: four new Chromium/mobile WebKit checks cover fixed positioning while scrolling,
no form resize, persistent errors, dismissal/reappearance, keyboard access within dialogs,
stacked failed/retry saves and 320/390/1440px layouts. Desktop/mobile captures were inspected.
Existing dropdown, workout/API, passkey cancellation and master-account flows pass (nine
checks). A stale Next development cache caused one reload-loop failure; a fresh cache resolved
it. Typecheck, lint, local and Docker production builds, and 51 unit/integration tests pass.
One Impeccable detector pass returned no findings; no suppressions were added.

Image `auctus:e84a322` is healthy. Public HTTPS Chromium/mobile WebKit checks verified real
member login/logout plus client-intercepted sign-in errors: fixed overlay, unchanged form
height and dismissal. No real failed authentication or training-data writes were needed.
Other service container IDs are unchanged. Backup: `auctus-2026-10-19T11-44-31Z.db`;
rollback image: `auctus:before-fixed-toasts-2026-10-19`. Local port 3105 also serves the update.

### Automatic toast expiry

Transient notifications, including errors and warnings, now inherit a five-second timeout.
Hover/focus still pauses expiry; manual dismissal remains available. Saving, offline and
unconfirmed-write notices persist until resolved so recovery controls are not lost.
Four Chromium/mobile WebKit notification checks pass, including automatic expiry, repeat
errors and dialog retry controls. Typecheck, lint, local/Docker builds and 51 unit/integration
tests pass. Public HTTPS tests confirm automatic expiry in both browsers.
Image `auctus:9fbd906` is healthy; unrelated service IDs are unchanged. Backup:
`auctus-2026-10-19T11-53-17Z.db`; rollback: `auctus:before-toast-expiry-2026-10-19`.

## Exercise equipment — 19 October 2026

Equipment is saved on reusable exercises and snapshotted in sessions. Five custom-menu choices cover Dumbbells, Stack machine, Plate-loaded machine, Cable machine (including rope attachments), and Other. Labels appear in library/search, workout editor, active exercises and history. Migration 0012 preserves old records as unclassified. Matching equipment is required for prior-weight and “Last time” suggestions.

53 tests across 18 files pass, including enum validation, older-client updates, populated database migration, session snapshots, mid-workout additions and exclusion of weights from a different equipment type. Typecheck and lint pass. Chromium and mobile WebKit cover required choices, all options, library editing/reload, equipment search, inline creation, workout/session labels, notification retry behavior, and layouts down to 320px. The existing full training workflow also verifies per-set weights, ranges, timers and history corrections. A menu layering defect found in the create dialog was fixed by raising the shared menu above the dialog. Desktop/mobile screenshots were reviewed; equipment uses neutral labels so workout status colors remain distinct.

Deployment: `auctus:91bf594` is live at https://auctus.ammarhadid.com. Pre-switch SQLite backup `/srv/backups/auctus/sqlite/auctus-2026-10-19T12-44-17Z.db` was verified; rollback image `auctus:before-equipment-2026-10-19` is retained. Migration startup reports integrity OK and container health is healthy. Public HTTPS checks in Chromium and mobile WebKit verify the deployed equipment choices and labels, responsive layout and logout; no page errors occurred. The dedicated test member now has an “Equipment examples” program and “Equipment walkthrough” template with four categorized exercises and warm-up/working rep ranges. No existing account data was deleted and no fixtures were created in the master account. Unrelated container IDs remained unchanged. Local production build is running at http://127.0.0.1:3105 with the migrated database.

## Mandatory and optional workouts — 19 October 2026

Workouts now have a non-null boolean `mandatory`, defaulting existing data to true. The custom menu exposes Yes — mandatory / No — optional. Subtle text labels are visible in programs, overview, active sessions and history. Weekly progress counts mandatory assignments only and reports optional completions separately; both still contribute to actual training metrics. Session snapshots retain their original requirement after template edits.

54 tests in 19 files pass, including strict boolean validation, omitted-field compatibility, migration of existing data, current-assignment updates, session snapshots, optional completion counts and an all-optional week. Typecheck and lint pass. Chromium and mobile WebKit verify creation/editing, persisted true/false values, labels, optional session completion, history and responsive layouts at 320/390/1440px. Desktop/mobile screenshots were inspected together. The full existing Chromium training workflow remains covered by its regression test.

Release `auctus:36dd661` is deployed and healthy at https://auctus.ammarhadid.com. The verified pre-switch backup is `/srv/backups/auctus/sqlite/auctus-2026-10-19T12-56-44Z.db`; the previous image is retained as `auctus:before-mandatory-2026-10-19`. Migration startup reports database integrity OK. Public HTTPS Chromium/mobile WebKit checks saved false then true, verified editor persistence and both mandatory/optional weekly counts, and restored the test member's original requirement and selected program. Existing main-account templates retain true. No training data was deleted, authentication remains intact, and unrelated containers kept their IDs. The local production build is running at http://127.0.0.1:3105.

## Equal weekly progress, mandatory minimum — 19 October 2026

Corrected the earlier interpretation after the user's clarification. All available planned workouts now count equally toward the weekly completion count and progress bar. A separate “Week done” milestone appears when every mandatory workout is complete, even while optional workouts remain. Optional completions keep increasing overall progress. Editor copy describes mandatory as a minimum commitment. Existing boolean values, session snapshots and training data are unchanged; no database migration is needed.

55 tests in 19 files pass, plus typecheck and lint. Coverage includes optional completions advancing the total without satisfying outstanding mandatory work, week completion with optional work remaining, further optional progress after week completion, repeat handling, withdrawn assignments and empty plans. Browser coverage checks actual optional completion followed by the mandatory workout and asserts 2/3 overall progress alongside Week done.

Release `auctus:2d641da` is live and healthy at https://auctus.ammarhadid.com. Public HTTPS checks passed in Chromium and mobile WebKit, including an all-optional plan with a full overall progress denominator, both boolean settings, editor persistence, and restoration of the test account's original values. Desktop/mobile local browser tests verified Week done at 2/3 workouts, with an optional workout still available. Backup `/srv/backups/auctus/sqlite/auctus-2026-10-19T13-03-34Z.db` is retained, along with image `auctus:before-weekly-progress-2026-10-19`. Unrelated containers retained their IDs. No schema or main-account data changes were made. The local build is running at http://127.0.0.1:3105.

## Bottom rest timer and mobile navigation — 19 October 2026

The rest timer now docks at the bottom, above mobile navigation. A top-right collapse icon hides the status text and controls, leaving the countdown and expand icon; expanding restores Pause/Resume, +5s, +15s, sound and End rest. Collapse does not stop the alarm or countdown. ResizeObserver measures the timer and navigation, reserving space after the page footer and setting scroll padding so all content remains reachable in both states. Toasts also clear the timer.

Navigation and timer share a bottom inset from the VisualViewport resize/scroll events, with resize and pageshow recovery. Mobile form text is at least 16px to avoid automatic input zoom, while pinch zoom remains available. The physical iPhone's intermittent misplacement was not reproduced directly; the viewport correction is covered by browser resize and simulated software-keyboard dismissal. Reference: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Validation: typecheck, lint and 55 unit tests pass. Chromium and mobile WebKit verify complete set → bottom rest timer → collapse/expand → pause/extend → End rest; both the last workout action and footer scroll above the timer. Navigation reaches the viewport bottom before/after resizing and simulated keyboard dismissal; cleanup removes reserved timer height. Existing looping-alarm checks pass in both engines. Four notification checks cover expiry, dialog access, retry and responsive positioning at 320/390/1440px. The Chromium resize assertion now waits for the measured layout rather than reading it before ResizeObserver fires. A shared alarm-account conflict was resolved by running each browser against its own temporary database, as the package's full E2E script already does. Stale Next development output caused reload loops after a production build; moving that generated cache aside resolved them.

Browser plugin not available; used the repository Playwright workflow at http://localhost:3100. Desktop (1280×720) and mobile WebKit (390×664 CSS pixels) screenshots were inspected. No application page errors were reported by the new layout checks. Physical iOS keyboard/browser-chrome animations remain a device-only verification limitation. No schema or training-data changes are part of this release.

Release `auctus:47bf737` is healthy at https://auctus.ammarhadid.com; public HTTPS Chromium/mobile WebKit checks passed for login, loaded collapse/expand code, library search, navigation resizing, mobile input sizing and clean console, without training writes. Backup: `/srv/backups/auctus/sqlite/auctus-2026-10-19T13-59-24Z.db`; rollback image: `auctus:before-bottom-timer-2026-10-19`. Unrelated container IDs are unchanged. The main account's Hypertrophy Foundation program remains present; its ongoing workout was preserved (the original import verifier's empty-session assumption was no longer valid, so post-deploy verification permits normal user activity). Local port 3105 also serves the current production build.

## Unified rest/navigation dock — 19 October 2026

The timer and mobile navigation now live in one fixed bottom dock, sharing an edge-to-edge surface and divider. A single measured dock height reserves page/footer space and positions notifications. The active rest stays available while navigating between application views. Desktop retains its sidebar and a bottom timer surface. Compact mode shows the countdown, End rest and expand icon; End rest uses the same stop-alarm/server action as expanded mode.

Collapsed/expanded preference is stored per account in this browser's localStorage, persists across reloads and subsequent rests/workouts, and updates across tabs. Storage restrictions fall back to an in-memory preference without blocking timer controls. This is a device/browser preference, not an account setting synchronized between devices. No database changes are needed.

Validation: typecheck, lint and 55 unit tests pass. Chromium and mobile WebKit verify shared-dock geometry, accessible final content/footer, both saved preference values after reload, the next rest using compact mode, pause/extend, and compact End rest. Existing alarm tests now explicitly end a looping alarm from compact mode in both browsers. Mobile notification checks pass, including dialog placement and expiry (one stale development-cache reload was resolved with a clean generated cache). Desktop and mobile expanded/compact screenshots were inspected; mobile timer and navigation have no floating-card gap. Physical iOS keyboard animation remains unverified; viewport-resize and simulated keyboard-dismissal regressions remain covered.
