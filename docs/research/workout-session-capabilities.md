# Workout session capability audit

Audit date: 2026-10-19. Read-only application inspection for the gym-session redesign. This document records existing behavior, not a proposal to remove it. No application code changed and no servers/tests were run during this audit.

## Current implementation and primary friction

The current view is a large form and exercise directory, not a guided logging loop. `src/components/workout/active-workout.tsx` renders the workout heading/actions, the complete exercise rail, then the selected exercise and every full set card. Under the mobile breakpoint the rail precedes the detail. Seven or eight exercise cards therefore push the actionable set well below the initial viewport. Each set carries edit/skip/remove/reorder controls, competing with the next useful action.

1. **The active task is not the first thing on screen.** All exercise navigation appears before the current set on mobile. Completing a set leaves the user where they were, without bringing the next set into view.
2. **Selected is not active.** Local `focused` exercise wins over the actual active exercise. Selecting an exercise is merely inspection; a separate Start/Switch action changes training state. Users can inspect one while another holds the active set, then receive a server rejection on attempting to switch.
3. **Too many lifecycle confirmations for routine flow.** Current sequence is Start workout → Start exercise → Start set → enter weight/reps → Complete set → optionally End rest → Start next set. Last set does not complete its exercise; Complete exercise is a separate action below all cards, and the user must select/start the next exercise separately.
4. **Hierarchy is repeated rather than explained.** Workout, exercise, and set all carry similar status treatments and controls. Full-width exercise cards visually resemble full-width set cards.
5. **Last-set completion is ambiguous.** All sets can be completed while the exercise remains active, so its green completion state requires an extra action. Finish workout then marks unfinished exercise statuses skipped even if recorded sets exist. Recorded data remains, but the label can conflict with the user's understanding.
6. **Generic progress is not an instruction.** “x/y sets recorded” excludes skipped sets and does not tell the user whether to rest, enter results, start the next set, or choose another exercise.
7. **The next action competes with destructive/rare actions.** Reordering, remove, prescription editing, corrections, abandon, and notes are prominent at the same time as the core logging controls. These should remain accessible through deliberate secondary controls.
8. **Reload loses viewing context.** `App` initializes view to dashboard. Continue workout must be pressed after reload; local exercise selection resets. Draft result values and timer state do survive.
9. **Last-time summary has different semantics from actual weight prefill.** The paragraph finds the newest completed workout exercise by exercise identity/equipment across history, whereas the actual prefill requires the same template set in the latest completed or abandoned instance of this template. Do not present the paragraph as the source of each suggestion.

## Domain hierarchy and identity

- **Workout template:** reusable plan; name, mandatory flag, notes, ordered exercise references, ordered set prescriptions. No target weight. Rep range/type/rest belong to each prescribed set.
- **Workout session:** one performed instance with immutable-at-start name/mandatory snapshot, mutable session notes, status, start/end timestamps, version, assignment/template IDs, resume child pointers, pauses and rest periods.
- **Exercise session:** snapshot of exercise name/equipment, ordered position, library identity, status/timestamps/removal marker, child sets. Changes to the library/template must not rewrite this snapshot.
- **Set session:** stable template-set identity where applicable, type, min/max reps, rest duration, status, actual weight in integer grams/reps, notes, timing, removal marker, and frozen prefill provenance.
- **Rest period:** separate record created after each completed set; ties to its source set. Planned duration, added duration, independent countdown pause durations, actual elapsed recovery duration, end reason.

Types are in `src/domain/types.ts`. Set kinds are normal, warmup, dropset, failure. Activity states are pending/active/paused/completed/skipped; workout terminal states are completed/abandoned.

## Capability preservation checklist

### Workout-level

- Start an available current-week assignment, or explicitly repeat an already completed assignment.
- Enforce one active/paused workout per account; restore unfinished work even across week rollover.
- Display session name, Mandatory/Optional indicator, active duration (excluding workout pauses), overall completed/total set count, and progress.
- Pause whole workout: pause active exercise/set, freeze active elapsed time and rest countdown, preserve exact resume child IDs.
- Resume same exercise/set; independently paused rest remains paused until explicitly resumed.
- Finish workout deliberately. Pending sets/exercises are skipped on confirmed `skipRemaining`; any active set must first be completed or skipped.
- Abandon even when paused/with an active set. Preserve recorded results/history; unfinished activity becomes skipped; close rests and pauses.
- Edit/save workout notes while active **or paused**.
- Navigate elsewhere in app without ending session; global rest dock remains visible; return through Continue workout.

### Exercise-level

- Inspect any nonremoved exercise, including completed/skipped exercises, without switching training state.
- Display order, name, equipment, status, completed/total visible sets and previous performance.
- Start pending exercise, resume paused exercise, deliberately switch between exercises in arbitrary order.
- Switching pauses the former active exercise, ends rest with `exercise_switch`, and is forbidden while any set is active/paused.
- Complete active exercise only once all nonremoved sets are completed/skipped. Completing exercise **does not end final-set rest**.
- Skip an unfinished exercise, preserving completed children and skipping its unfinished children. Its active set must first be resolved. Skipping active exercise ends rest.
- Add existing exercise through searchable custom picker; create a new library exercise inline with query-prefilled name and equipment; add session exercise with at least one prescribed set.
- Reorder exercises up/down in session without altering reusable template.
- Soft-remove a nonactive exercise; preserve completed records/history. Server supports removing terminal exercises, though current UI hides remove once exercise is completed/skipped.
- Empty session state supports add exercise or finish workout.

### Set-level

- View set number/type, planned rep range/rest, status; completed results show weight × reps.
- Start any pending set in active exercise, not strictly the next position; only one active/paused set across workout.
- Starting a set ends active rest with `next_set`; the user need not explicitly End rest first.
- Start freezes matching historical weight suggestion. First use/no match is empty. User can change/clear weight before completion.
- Enter weight and actual reps with mobile decimal/numeric keyboards; weight 0–2000 kg in 0.001 kg increments, reps integer 0–1000; required fields.
- Optional set notes; local per-account/per-set draft retains weight/reps/notes across reload; blanking a suggestion remains intentionally blank.
- Complete set once; record actuals/timing/notes, then create rest, even for final or zero-rest sets.
- Skip pending/active set; cannot skip completed/skipped set. Skipping does not create a rest.
- Edit pending prescription: type, min reps, max reps, planned rest (0–3600 sec); validate max ≥ min. Session-only, does not rewrite template.
- Correct completed result during active workout: weight/reps/notes, without changing plan or creating another rest.
- Add set to any nonterminal exercise; default normal/8 reps/90s currently comes from `defaultSet()`; session-only added sets have no historical template-set identity.
- Reorder sets; preserve IDs/prefill mapping despite positional changes.
- Soft-remove pending/completed/skipped sets with confirmation; preserve recorded result history. Cannot remove active/paused set.
- Whole-workout pause disables active result submission and normal mutations; do not lose drafts.

### Rest and persistent dock

- Shared bottom dock with mobile navigation, fixed to visual viewport bottom; mobile integrated surface; desktop floating timer surface.
- Expanded controls: countdown, planned/added/actual recovery duration, independent rest pause/resume, +5s/+15s, sound on/enable, End rest.
- Compact controls: countdown + End rest + expand icon; preference persisted per-account in browser and used across rests/reloads/workouts.
- Orange paused / overtime indication; expiry continues into +MM:SS until actual rest ends.
- End rest immediately stops audible alarm and persists closure. No separate Stop alarm/Test alarm production control.
- Sound activation requires user gesture; looping foreground alarm until End rest, next set/switch, mute/pause, or equivalent rest closure. Expiration shouldn't be consumed while audio suspended or muted.
- Background alerts configuration, push worker scheduling/cancellation and platform limitations must remain intact. Do not promise native continuous background alarm on iPhone.
- Preserve content bottom spacing measured with ResizeObserver so last action/footer scrolls above dock; viewport offset handles mobile keyboard/browser chrome; safe-area padding; preference remains account-scoped.
- Timer remains global when user visits Library/History/Settings, not only workout view.

### Reliability, account safety, history

- Authoritative server state after every command; serial UI mutation lock; versions reject stale changes with409 and refresh.
- Request UUID receipts make retries idempotent (lost response cannot duplicate set/rest/additions).
- Persist a single uncertain request locally per-account. Retry same payload/ID, or explicit discard-and-refresh; reject new mutations while uncertain.
- Offline banner clearly says not confirmed saved; drafts remain local; online/visibility change refresh; periodic visible refresh60s.
- Expired sign-in error offers new-tab login without discarding local draft/request.
- Busy state disables fields and dock; fixed toasts auto-dismiss ordinary errors, persistent offline/unconfirmed-save warnings remain actionable.
- Account context on requests and account-scoped storage must not leak or reuse another account's data.
- Finished workout corrections live in History (existing separate workflow). Preserve equipment snapshot, mandatory snapshot, set type/targets, actual rest/timing, removals and corrections.

## Server state/action map

`Sessions.act` runs each action in an immediate SQLite transaction with an exact version check and increments version once. Unless noted, workout must be active. All child actions are scoped by workout lookup.

| Action | Preconditions | Result / important side effect |
| --- | --- | --- |
| workout.pause | active workout | pause active children; open workout pause interval |
| workout.resume | paused workout | close pause; restore recorded children; clear pointers |
| workout.complete | active; no active/paused set; all exercises terminal unless explicit skipRemaining | close rest/pauses; skip unfinished; completed workout |
| workout.abandon | active or paused | preserve results; skip unfinished; close rest/pauses; abandoned workout |
| workout.notes | active or paused | update notes |
| exercise.start | pending/paused, nonremoved; no active/paused set anywhere | close rest; pause old active exercise; activate selected |
| exercise.complete | active; no unfinished nonremoved sets | mark completed; rest remains open |
| exercise.skip | unfinished nonremoved; no active child set | skip unfinished children; close rest if this exercise active |
| exercise.add | active library exercise;1–100 valid sets | append pending snapshot |
| exercise.reorder | every stored exercise ID exactly once, including removed | persist new positions |
| exercise.remove | nonremoved; nonactive; no active/paused children | soft-remove exercise/all sets; preserve completed status/results |
| set.start | pending nonremoved; parent active; no other active/paused set | close rest; freeze prefill; set active/start time |
| set.complete | active | save validated actuals; mark completed; create rest |
| set.skip | unfinished nonremoved | skipped/end time; no rest created |
| set.prescription | pending nonremoved | update type/reps/rest only |
| set.edit | completed | correct actual weight/reps/notes only |
| set.add | nonremoved nonterminal exercise | append pending set with null template-set ID |
| set.reorder | every stored child set ID exactly once, including removed | persist new positions |
| set.remove | nonremoved; not active/paused | soft-remove; retain completed results |
| rest.pause | matching open rest; countdown not independently paused | freeze countdown, actual recovery still elapses |
| rest.resume | matching open independently paused rest | accumulate pause duration excluding workout pauses |
| rest.extend | matching open rest; exactly5000 or15000ms | add duration without changing prescription |
| rest.end | open rest | close with manual reason |

## Weight prefill contract

**Superseded on 20 October 2026:** the user requested the latest completed set for the same exercise, equipment and set type across all workouts, including the current exercise session. Both weight and reps are now snapshotted on `set.start` / `set.begin`. The original audit below describes the old behavior, not the current implementation.

`Sessions.act('set.start')` finds the **latest completed or abandoned workout of the same template**, ended before this workout began. Within that one instance it requires matching template-set ID, type, library exercise ID, and equipment; completed, nonremoved set and exercise. No borrowing from a different working set, warm-up, older workout when newest lacks it, or today's earlier result. Corrected/zero historical loads are valid. Type/equipment changes and session-only additions leave suggestion empty. Prefill is persisted at start, actual weight remains null until user completion.

This can constrain a redesigned pre-start edit surface: do not show guessed previous weights before server start unless a dedicated read model follows this exact matching contract.

## Implementation constraints / safest simplification

- Put one current exercise/one actionable set in the default viewport, with compact completed/upcoming rows. Keep workout overview and all secondary controls available through clearly named disclosures or dialogs.
- Separate **inspect plan** from **switch/start exercise**, or provide a guided transition that makes the distinction explicit. Always make the actual active set recoverable in one tap.
- A single user gesture can combine “start exercise + start set,” or “complete exercise + start next,” but must be **one validated server action/transaction** (or explicitly carry returned version). Chaining current `act` closures twice uses stale workout.version and produces409. Never auto-start effort timing while the person is still resting.
- Auto-completing exercise when final set resolves would change lifecycle semantics; cover terminal statuses, all-skipped exercises, session-only additions, rest continuity, and manual completion in domain tests. Avoid frontend-only silent terminal state.
- Preserve arbitrary order and switch capability for occupied gym equipment; guided sequence must remain a recommendation.
- Keep finish/abandon confirmation honest about skipped work. Prefer disabled action with clear prerequisite over a generic error when active set prevents finish.
- Keep visual progress terms clear: completed vs skipped vs remaining; status icon/text alongside requested color tokens (blue active, orange paused, red skipped, green completed).
- Do not mount two copies of editable SetCard for a table/detail or desktop/mobile view. Duplicate IDs/local draft state/forms could diverge; render one editor with one set identity key.
- Do not reset local form edits on every authoritative refresh; key draft by account and set. Use onConfirmed callback if UI advancement must work after retry of an uncertain command.
- Reorder payloads currently require removed records as well. Displayed indices may differ from stored indices; maintain full-ID payload while exposing only visible rows.
- `RestTimer` currently lives in global `BottomDock`, separate from ActiveWorkout. Any context cue (“Next:…”) should derive from shared authoritative state, not be stored only inside the workout view.
- Existing custom select/search/dialog patterns and Arial/color tokens should be reused. No data reset, new equipment naming, or unrelated auth changes are required by this redesign.

## Existing automated coverage to retain/adapt

- `tests/session.test.ts`: lifecycle, deliberate arbitrary order, active-set switch guard, full pause/resume, final-set rest continuity, abandonment preservation, idempotency/versioning, week rollover, add/remove/reorder, prescription/result editing, independent rest pause/extension.
- `tests/weight-prefill.test.ts`: warm-up/each working set isolated, stable IDs through reorder, zero/corrected weights, skipped/removed/latest-history semantics, changed types/session-only additions.
- `tests/equipment.test.ts`, `tests/rep-ranges.test.ts`, `tests/workout-mandatory.test.ts`: snapshots/identity, rep-range validation, weekly goal semantics.
- `tests/reliability.test.ts`: DB restart/live rest recovery, backup consistency, repeats/archiving, referential integrity.
- `tests/rest-sound.test.ts`, `tests/push.test.ts`, `tests/service-worker.test.ts`: audio/background alert invariants.
- `e2e/workout.spec.ts`: author→start→plan edit validation→log→draft reload→rest pause/extend→workout pause/reload→finish→history correction/progress; offline retry and committed-write/lost-response idempotence; prefill reload and intentional blank; cross-screen version race; abandonment; no production test-alarm controls.
- `e2e/rest-layout.spec.ts`: mobile bottom alignment, no content obstruction, collapse preference/reload/next rest, compact End rest, viewport resize and simulated iOS keyboard dismissal.
- `e2e/rest-alarm.spec.ts`: loop alarm beyond expiry until End rest from compact dock, closure persists after reload.
- `e2e/equipment.spec.ts`, `e2e/weight-prefill.ts`: equipment through create/session/history and separate per-set suggestions.

Add focused journey acceptance for initial actionable viewport at320/390px with a real seven-exercise workout; next-set and next-exercise transitions without page search; explicit skip/switch during rest; inspect another exercise while an active set exists; resume after reload; and full keyboard/screen-reader focus behavior for new secondary surfaces. Existing E2E selectors intentionally encode old Start exercise/Start set sequence; update assertions to new user-visible journey while retaining behavioral coverage.
