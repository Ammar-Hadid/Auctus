# Dashboard statistics and weekly attendance

Researched 22 October 2026 before implementation. The brief is an informative, simple dashboard, with completed training days crossed off, consistent with Auctus's workout and session screens.

## Method and limits

This is a review of official product documentation for Hevy, Strong, and Fitbod, combined with inspection of Auctus's existing data model. It establishes comparable product patterns; it is not a controlled usability study or scientific evidence that a metric improves strength. The priorities below are design recommendations inferred from those patterns and the user's requirements. Strong's exercise-detail documentation dates to 2021; exact current placement has lower confidence. No exercise prescription, recovery score, calorie estimate, or physiological benefit is inferred.

## First-party evidence

### Hevy: attendance and a small set of totals

Hevy's widgets offer workout count, sets, reps, duration, and volume. Its calendar-plus-stats widget combines recorded training days with monthly totals. A separate weekly widget compares a selected metric with the previous week. Routine scheduling is another feature: users explicitly assign a routine to a weekday. This supports a compact overview with attendance and selectable historical metrics, while keeping recorded activity distinct from planned activity. [Official widget guide](https://help.hevyapp.com/hc/en-us/articles/36956630666647-Hevy-App-Widgets-Explained-Setup-Features-and-How-to-Use-Them)

Hevy's calendar highlights days containing workouts and links dates to completed workout details. Its streak counts consecutive weeks containing at least one workout. The guide explicitly says the calendar cannot plan future workout days. Auctus should distinguish a weekly attendance strip from a user-defined future schedule. [Official calendar and streak guide](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features)

Hevy also provides exercise performance, weekly/monthly set charts, and a monthly recap of workouts, volume, sets, records, and active days. Its muscle charts depend on primary and secondary muscle metadata. Auctus currently lacks that mapping, so a body diagram would require additional verified exercise data. [Official progress overview](https://www.hevyapp.com/features/gym-progress/)

### Strong: contextual comparisons

Strong places an exercise's history, charts, and records together. Charts depend on exercise type; records include performances at different repetition counts. This supports linking summary progress back to the underlying sessions rather than presenting a disconnected score. [Official exercise-detail guide](https://help.strongapp.io/article/237-about-exercise-detail)

Strong's focus metric is chosen per exercise and compared with the previous performance of that exercise. Available metrics include volume, weight/reps, time, and distance. This supports comparing like exercises and clearly naming the quantity. [Official focus-metric guide](https://help.strongapp.io/article/226-focus-metric)

### Fitbod: exercise trends with the original log nearby

Fitbod's February 2026 exercise-history update shows selectable metric/timeframe charts and exact logged sets beneath them. Records cover estimated strength, weight, volume, reps, and weekly goals. Fitbod says it renamed projected one-rep max to estimated strength because users did not understand the original term. This is evidence for readable terminology and access to actual logged values, not validation of Fitbod's estimates or a reason to copy its proprietary scoring. [Official exercise-history announcement](https://fitbod.me/blog/exercise-history-and-records/)

## Recommended dashboard hierarchy (design inference)

1. **What to do now:** preserve the active-workout resume action and the program's remaining workouts. Do not bury the actual training action below analytics.
2. **This week's attendance:** show Monday–Sunday with date, today marker, and a check/strike-through on days containing a completed workout. Provide a textual completed state as well as color. Show distinct training-day count; two sessions on Tuesday still count as one day. Empty past dates mean “No workout logged”; future dates mean “Upcoming,” not failed or prescribed rest. The user can understand the week without reading a chart legend.
3. **Four readable weekly totals:** workouts completed, sets completed, logged lifting volume, and training time. Explain volume as logged weight × repetitions. Explain training time as session time excluding workout pauses, including rest. Keep these units consistent with session history.
4. **One compact history chart:** six to eight weekly bars; default to completed workouts, with tabs for volume and sets if useful. Start count/volume axes at zero, label dates and units, show exact values accessibly, and mark the current week as in progress. Avoid plotting several unrelated scales together. A short history should stay truthful rather than manufacturing a smooth trend.
5. **Exercise progress:** a selected exercise's actual heaviest completed working-set weight over its recent sessions, with the associated reps and link to its log. This answers “What have I been lifting?” without presenting an unvalidated overall strength score. One recorded session is a starting point, not an improvement trend.
6. **Recent sessions:** a short list of completed workouts with date, sets, and duration, linking to existing history. This gives the totals an inspectable source and preserves familiar session-page language.

Weekly assignment progress should remain separate from workout count: completing three different assigned workouts out of four is 3/4, while repeating one of those adds a completed session without increasing assignments completed. Mandatory/optional distinctions must remain intact.

## Auctus data contract and metric caveats

Verified against `src/domain/types.ts`, `src/domain/metrics.ts`, `src/domain/calendar.ts`, `src/domain/timing.ts`, `src/domain/weekly-goal.ts`, and `src/server/read-state.ts`.

- **Completed only:** history contains completed and abandoned workouts. Dashboard completion totals must explicitly filter completed sessions. Active, paused, abandoned, pending, and skipped activity must not appear as completed attendance.
- **Recorded work:** existing `summarize` counts completed sets, including warm-ups, and calculates kg × repetitions from their recorded values. Do not relabel that aggregate “working sets.” Missing load must not become a fabricated weight; a zero volume with completed sets can simply mean no external load was logged.
- **Volume has limits:** this is a log total, not a fitness score or demonstrated muscle growth. It changes with exercise choice, repetitions, and logging conventions. More must not automatically be celebrated as better. Do not multiply unilateral/dumbbell loads without an established data contract.
- **Duration has limits:** `activeDuration` subtracts explicit workout pauses, but rest remains part of session time. “Training time” needs that explanation; “time lifting” would be inaccurate.
- **Exercise trend:** existing `exerciseProgress` excludes warm-up sets from heaviest-load and estimated-max calculations. Keep exercise IDs stable for comparisons; names alone can collide. Include repetitions next to an actual top set so a heavier single is not silently presented as a better ten-rep performance. Do not count first-ever data as a new improvement over zero.
- **Calendar versus training week:** Auctus's program week resets Monday at 03:00 Europe/Amsterdam, and current/previous server totals are attributed by assignment week. Actual attendance should use the session's Amsterdam calendar date (normally its start), not an assignment's week ID. These can differ for sessions crossing a reset. Label the distinction or explicitly unify the new chart's time attribution without changing existing plan semantics. Build local calendar days with timezone-aware date operations across daylight-saving changes.
- **Comparison windows:** the current week is partial. A full last-week number can be shown as context only when named “last full week”; avoid a red decline/green improvement percentage suggesting equivalent periods. Alternatively compare elapsed portions of both weeks and label that choice. Do not divide by a zero baseline.
- **Scheduling:** assignments currently have no weekday/date field. An automatically checked attendance strip meets the request to see days already attended. If editable future planning is added, persist the user's explicit date/weekday choice separately; never distribute workouts across weekdays and present that guess as their schedule.
- **Unavailable inputs:** no muscle mapping, body composition, sleep, readiness, or calorie data exists in this model. Do not introduce estimated recovery, muscle balance, calorie burn, or a universal strength score to fill space.
- **Empty and incomplete data:** display a clear first-workout prompt and unpopulated charts. All chart labels, values, and states must remain accessible without hover or color. Do not populate the signed-in dashboard with demonstration statistics.

## Landing-page implications

After implementation, update the landing page to describe and show the actual dashboard: weekly attendance, visible workout progress, and trends from completed sessions. Use a real screenshot of the implemented showcase data, keep demonstration data confined to the showcase, and avoid claims that analytics predict recovery or guarantee results. Maintain Auctus's existing visual language rather than introducing a competing dashboard brand.
