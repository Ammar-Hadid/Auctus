# Workout session UX research

Researched 2026-10-19 for the active-workout redesign. User evidence: in the gym, the user loses their place, has to scroll between context and controls, cannot immediately distinguish a workout from an exercise or set, and wants a simpler journey without losing functionality.

## Method and confidence

This is a first-party documentation review of Hevy, Strong, and Fitbod. Product behavior below is supported by the linked official help pages. It is not a hands-on usability comparison or proof that a competitor pattern is optimal. Strong's linked articles remain live but were last updated in 2021–2022, so precise present-day screen placement has lower confidence. Fitbod's exercise-details guide was updated April 2026. Recommendations are our design inferences, identified separately from sourced behavior.

We deliberately do not infer phone behavior from watch documentation. Native lock-screen widgets, background audio, or watch integrations are not capabilities a web app gains by copying an interface.

## Evidence

### Hevy

- **Plan versus record:** Hevy distinguishes reusable routines from workouts being logged at the gym. Starting a routine opens an active workout. This separation directly addresses the user's earlier confusion about templates and actual performance. [Workouts vs Routines](https://help.hevyapp.com/hc/en-us/articles/33703513582871-Workouts-vs-Routines-in-Hevy-What-They-Mean-and-How-to-Use-Them)
- **Explicit workout endpoint:** Starting from a routine, empty workout, or copied history all converge on logging details and an explicit Finish action. [Logging guide](https://help.hevyapp.com/hc/en-us/articles/35361530647959-How-to-Log-a-Workout-in-the-Hevy-App-Step-by-Step-Guide)
- **Previous performance in context:** A Previous column shows the last performance of the exercise. A setting chooses any workout or the same routine. Previous data is explicitly distinct from the current weight/reps inputs. [Previous performance](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)
- **Rest is a consequence of logging:** When enabled for an exercise, rest starts automatically after completing a set. The active countdown has +15/−15 controls; changing the planned exercise duration is a separate action. [Rest timer](https://help.hevyapp.com/hc/en-us/articles/35385404949143-Rest-Timer-Default-Rest-Timer-How-to-Add-Adjust-Volume-and-Sound)
- **Navigation can follow training order:** Smart Superset Scrolling optionally moves to the next exercise in a superset on completion and wraps back for the next round. This evidence applies specifically to supersets, not an assertion that all ordinary Hevy sets automatically scroll. [Smart scrolling](https://help.hevyapp.com/hc/en-us/articles/35650286563095-The-Complete-Guide-to-Supersets-and-Smart-Superset-Scrolling)
- **Secondary set controls:** Tapping the set number opens the set-type selection. Warm-up, drop, and failure sets have different semantics; a following dropset suppresses the normal rest timer. [Set types](https://help.hevyapp.com/hc/en-us/articles/34896293707927-Set-Types-in-Hevy-Explained-Drop-Sets-Warm-Up-Sets-and-More)
- **Compact orientation:** Its native live activity exposes next activity, set progress, prescribed values, elapsed time, and set completion. Rest replaces that immediate action context with a countdown and adjustment controls. This is evidence for compact information hierarchy, not a web implementation recommendation. [Live activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399-How-to-Use-Hevy-s-Live-Activity-on-iOS-and-Android)

### Strong

- **Hierarchy and primary action:** The documented workout is an ordered exercise list; each exercise contains sets. The user edits weight/reps then checks the set as completed. Exercises/sets/notes remain editable during training; Finish explicitly ends the workout and may be used before every exercise is complete. [Performing a workout](https://help.strongapp.io/article/229-my-first-workout)
- **Compact versus expanded rest:** Rest automatically starts on set completion and is visible in a small timer. Tapping expands it for duration changes or skipping. Warm-up and working-set durations can differ. [Rest timer](https://help.strongapp.io/article/231-rest-timer)
- **Progressive disclosure:** A set-number interaction exposes warm-up/drop/failure tags, instead of presenting a full type editor on every ordinary set. [Set tags](https://help.strongapp.io/article/166-set-tags)
- **Workout editing does not inherently rewrite the plan:** After a modified workout, Strong offers updating the template or retaining it, with separate options for structure and values. Its own article notes continuing work to reduce confusion in this flow. Auctus should preserve its established plan/session boundary rather than import these extra choices. [Template update](https://help.strongapp.io/article/177-update-template)

### Fitbod

- **Exercise-focused detail:** From an active workout list, tapping an exercise opens its detail screen with name, recommendations, history, side-specific labels, notes and rest. Weight/reps are edited directly. Notes and less-frequent controls live under More. [Exercise detail navigation](https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen)
- **Actual values and unit meaning:** Fitbod's guidance says to log actual performance. It explicitly labels unilateral reps per side and dumbbell weight per dumbbell. It distinguishes total bar-plus-plates from plates-only conventions. These labels prevent mistakes; they are not decorative metadata. [Fields explained](https://help.fitbod.me/hc/en-us/articles/29486697282711-Exercise-Details-Screen-Sets-Reps-and-Weight-Fields-Explained)
- **Automatic rest with scoped editing:** Logging a set starts rest. Pre-workout edits change exercise rest durations; an in-progress timer adjustment affects the current rest only. Its documentation distinguishes foreground sound from background push notifications. [Rest timer](https://help.fitbod.me/hc/en-us/articles/360006340194-Rest-Timer)
- **Automatic next action on a constrained screen:** Fitbod's WearOS guide documents set markers, a Log Set action, and automatic progression to the next exercise. The same guide states watch logging does not initiate rest timers. This supports automatic orientation as a pattern but must not be represented as verified phone behavior or complete feature parity. [WearOS logging](https://help.fitbod.me/hc/en-us/articles/4406074415383-WearOS-on-Android)

## Design synthesis for Auctus (inference)

The useful common pattern is **record what happened → complete one set → rest → perform the next set**. The user should not need to manage three nested lifecycle forms after every lift. A focused current-exercise view can coexist with a complete workout overview; simplification means prioritizing the immediate action, not deleting capability.

### Priority 1: always answer where I am and what I do next

1. A compact workout header identifies the workout, elapsed time, and completed/total sets. A visible control opens the workout's exercise overview. Do not label the live screen with internal terms such as exercise session or set session.
2. Give the current exercise a clear heading, equipment, ordinal (for example Exercise 2 of 7), and exercise status. Sets are compact rows within it, not large cards that look like peer exercises.
3. Make one pending/current set visually primary. Display its type, rep-range target, last performance, and current actual-value fields with clear labels. Existing warm-up/working history matching remains intact.
4. The main action names the operation: Start set when an explicit start is required by Auctus's timing model, then Complete set. Never make Complete exercise and Complete workout equally prominent beside each set.
5. After set completion, immediately show the saved result, mark the set complete, start the existing rest timer, and prepare the next set in the same stable area. On the last set, clearly state that the exercise is complete and show the next exercise action. Do not force a manual trip back to the top of a long page.
6. Keep a visible path back to the current unfinished exercise when the user inspects another exercise. Do not silently change the running exercise because the user browsed the overview.

### Priority 2: retain control without constant clutter

- Keep the integrated bottom rest/navigation bar the user requested. Preserve compact/expanded preference and End rest in compact mode. Expanded view retains pause/resume, +5, +15 and sound controls. Show which set/exercise follows rest so the timer also provides orientation.
- Place exercise actions (skip, pause/resume, details and any existing adjustments) in a clearly labeled disclosure/menu. Keep set edit/undo/skip available by the row. Expose destructive actions deliberately rather than beside the frequent completion target.
- Provide an overview listing all exercises with completed/total set counts and textual states. Clicking an exercise should jump directly to its work area. Completed/skipped exercises remain inspectable; progress must distinguish completed work from skipped work.
- Preserve existing actual versus planned duration, equipment notes, set types, rep ranges, prior weights, exercise notes and history access. Do not replace readable text with icons alone.
- Finish workout remains available at workout level and becomes the obvious next action at the end. If unfinished items remain, the review/confirmation must explain what will happen. Never silently complete skipped or pending sets.

### Priority 3: mobile implementation constraints

These are implementation acceptance requirements inferred from the user's real gym problems, not claims about a particular competitor:

- Current exercise, set position and primary action must remain easy to locate after a rest ends or an input keyboard closes.
- Reserve space for the bottom bar in both expanded and collapsed states; verify the last actionable item can scroll above it and mobile navigation remains viewport-anchored.
- Large labeled numeric inputs, clear kg/per-dumbbell and reps/per-side conventions, and touch targets that remain usable at 320–390 px. No horizontal scrolling to log a set.
- Use text/icons with the established blue active, orange paused, red skipped, green complete colors. Do not rely on tint alone or allow completed set rows and exercise headers to look structurally identical.
- Keep editing stable: do not auto-scroll or replace a focused numeric input. Automatic next-step navigation should happen after a successful explicit action, not due to a background refresh.
- Preserve unsaved edits and surface saving/error state. A failed completion must not advance the journey or pretend the set was recorded.

## Acceptance journey to test before release

1. Resume an existing session and immediately identify workout, exercise, current set and next action.
2. Complete a normal set with prefilled weight unchanged: no navigation through separate pages or nested lifecycle panels.
3. Change weight/reps, complete, observe the saved values, rest, then continue to the next set without searching the page.
4. Finish an exercise, see a positive completion state, and reach the next exercise in one explicit transition while retaining access to the finished exercise.
5. Browse a different exercise during rest, then return to the current unfinished exercise without losing drafts or changing active timing unintentionally.
6. Pause/resume, skip, edit or undo according to existing supported semantics; ensure those controls remain reachable and that skipped work is not reported as completed work.
7. Reload with a running rest timer and collapsed preference; verify countdown, controls and bottom spacing survive.
8. Test first-use empty weight, warm-up versus working-set prefill, rep ranges, different equipment and unilateral notes.
9. Finish with all work complete, and separately attempt finishing with work remaining. Verify accurate history and no unintended template changes.
10. Verify at 320 px and 390 px mobile, keyboard open/closed, expanded/collapsed timer, and desktop; no obscured final controls or mid-screen bottom navigation.

## Scope boundary

Research does not justify adding supersets, adaptive programming, videos, native widgets or new analytics in this redesign. Existing Auctus capabilities and data semantics are the requirements. Competitor features are evidence for arranging controls, not permission to expand scope or remove the user's existing controls.
