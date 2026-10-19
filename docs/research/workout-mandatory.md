# Mandatory workouts

A workout template has a non-null `mandatory` boolean. Every planned workout, mandatory or optional, contributes equally to the week's overall completion count and progress bar. Mandatory identifies the minimum commitment: completing all mandatory workouts marks the week done, even when optional workouts remain. Completing optional workouts continues advancing overall progress after that point. Repeats remain included in actual training metrics, but each planned workout counts once in plan completion. An all-optional week has no mandatory minimum and does not display a “Week done” milestone; empty plans also do not claim completion.

This replaces the initial interpretation that excluded optional workouts from weekly progress. The user's clarification is authoritative: optional workouts are equally valued, while mandatory workouts define when the week can be called done.

The editor uses the shared Auctus menu: “Yes — mandatory” and “No — optional.” Small neutral Mandatory/Optional text labels distinguish workouts in programs, the overview, active sessions, and history without competing with activity status colors.

Migration 0013 gives existing templates and session snapshots true to preserve prior behavior. New forms default to true, with an explicit choice available on every save. The API validates real booleans; older clients that omit the field retain an existing value, or receive the default for a new template. SQLite stores constrained 0/1 values, which become JSON booleans at the read boundary.

Weekly assignments use the template's current setting, so edits immediately update the minimum needed to call the week done without changing a workout's contribution to overall progress. Started sessions snapshot the flag and retain it through future template edits. This change does not prevent skipping or abandoning mandatory workouts, or impose new scheduling restrictions.
