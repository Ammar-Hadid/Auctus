# Mandatory workouts

A workout template has a non-null `mandatory` boolean. True means planned work that counts toward the weekly mandatory goal; false means optional extra work. Both remain available to start and both contribute to actual training metrics. Optional work has its own completed count and never inflates the mandatory goal. An all-optional week explicitly says there are no mandatory workouts.

The editor uses the shared Auctus menu: “Yes — mandatory” and “No — optional.” Small neutral Mandatory/Optional text labels distinguish workouts in programs, the overview, active sessions, and history without competing with activity status colors.

Migration 0013 gives existing templates and session snapshots true to preserve prior behavior. New forms default to true, with an explicit choice available on every save. The API validates real booleans; older clients that omit the field retain an existing value, or receive the default for a new template. SQLite stores constrained 0/1 values, which become JSON booleans at the read boundary.

Weekly assignments use the template's current setting, so edits immediately update the current goal. Started sessions snapshot the flag and retain it through future template edits. This change does not prevent skipping or abandoning mandatory workouts, or impose new scheduling restrictions.
