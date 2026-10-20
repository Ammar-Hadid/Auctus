# Guided workout session — design and verification

19 October 2026. Implemented from the user's in-gym feedback, the [capability audit](workout-session-capabilities.md), and [first-party competitor research](workout-session-ux.md). Research covered Hevy, Strong and Fitbod. Mobbin's flow search was unavailable to this account; no Mobbin screenshots were used.

## Observed starting point

A fresh in-app-browser inspection used an isolated seven-exercise, three-set sample workout. At a narrow phone viewport the first screen showed the workout header, finish/pause actions and only the beginning of the exercise directory. The first set was below all seven exercise cards. Every set repeated plan editing, skip, remove and reorder controls. [Before screenshot](images/workout-before.png).

## Intentional control placement

- **Workout context:** name, elapsed active time and completed/total sets. The slim sticky toolbar always exposes Workout overview and Workout options. Pause/resume, finish, notes and abandon live together in the workout dialog.
- **Exercise section:** ordinal, name, equipment and explicit activity status form a distinct heading. It is structurally different from a set row. Blue means active, orange paused, red skipped and green completed; every state also has text and an icon.
- **Current set:** one editor and one primary action, Start set or Complete set. The weight/reps fields align side by side. Notes and plan/result changes sit in labeled disclosures. Account-scoped drafts survive browsing and reloads.
- **Set ledger:** compact rows show type, rep range, rest and actual result/status. Selecting a row permits inspection/correction; a clear return action restores the current step or exercise summary.
- **Overview:** an on-demand dialog lists every exercise with progress, supports direct inspection and keeps reordering/addition in deliberate controls. Inspecting an exercise never silently changes active timing. Nested search/create dialogs preserve keyboard access and fixed save-recovery notifications.
- **Exercise options:** the control below the ledger opens a dialog for extra sets, skip/remove, reordering and previous performance/technique. Changes affect this workout, not its template.
- **Rest:** the existing unified bottom timer/navigation remains. Expanded phone controls use one compact row; compact mode retains End rest and the saved per-account browser preference. Sound state has an accessible name, pressed state and distinct muted icon. Measured bottom spacing keeps final content reachable.

## Routine journey

Start set performs the exercise and set start atomically, with a single version check and the existing exact historical-weight match. Complete set saves actuals, starts rest and presents the next set in the same place. The final resolved set marks its exercise completed (or skipped when none were completed), keeps final rest running and offers an explicit Start next exercise handoff. Effort timing never begins automatically during recovery. Extra sets can reopen a finished exercise without disturbing another active exercise. Reload opens an existing workout directly.

Rare changes remain explicit. Finish/abandon/remove use confirmation; finishing cannot bypass an active set. Correcting results and removing entries preserves history. Reordering swaps visible neighbors while retaining removed IDs in the complete server payload. Confirmed callbacks also run after retry of an uncertain save; failed saves do not advance the interface.

## Scope and limits

No schema migration, account reset, exercise/equipment renaming or template-weight change. The user's production records and current workout are preserved. Arial and the existing Auctus visual tokens remain. Continuous native background alarms on iOS are not added by this redesign; existing foreground sound/push behavior remains.

Browser checks cover 320/390px phones, tablet/desktop widths, Chromium and mobile WebKit, along with keyboard focus, viewport resizing and simulated software-keyboard dismissal. A physical iPhone gym session remains the final experiential check; browser emulation cannot prove every iOS keyboard animation or real-world ease of use.

## Rendered outcome

Fresh screenshots from the production build in mobile WebKit, with isolated sample data:

- [Next set and expanded rest dock](images/workout-rest.png)
- [Completed exercise and explicit next-exercise handoff](images/workout-finished.png)

The next-set button remains visible above the expanded dock. The completed exercise has a green heading, a saved-set count and a named next exercise. Sets remain compact result rows underneath.
