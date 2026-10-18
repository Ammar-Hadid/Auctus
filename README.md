# Auctus

A private, single-user workout journal: manually authored programs, weekly assignments, persistent live workouts, planned/actual rest, editable history and exercise progression. Built with Next.js, strict TypeScript, SQLite/Drizzle and Better Auth.

## Local setup

Use Node **24 LTS** and pnpm **11.25.0**. With nvm, run `nvm install && nvm use`. Corepack or `npm install -g pnpm@11.25.0` supplies pnpm.

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm db:migrate
pnpm run owner
pnpm dev
```

`pnpm run setup` creates a private, ignored `.env.local` containing a random authentication secret. `pnpm run owner` prompts for your email and a hidden password (12–128 characters). Re-running it changes the owner credentials and revokes all login sessions. Use the explicit `run`: `pnpm owner` is pnpm’s registry-owner command, not this application’s setup script. No public signup exists. Open [127.0.0.1:3105](http://127.0.0.1:3105).

Your data lives at `data/auctus.db`, outside Git. Never delete this directory to update the app. Set `DATABASE_PATH` to another local persistent path if needed. The canonical `BETTER_AUTH_URL` must match the origin you open, including the port.

## First workout

1. Add exercises in **Library**.
2. Create a program in **Programs** and open it.
3. Add workouts, ordered exercises, set types, minimum/maximum reps and rest times. For 6–8 reps, enter minimum 6 and maximum 8; for an exact target, use the same number in both fields. Choose **+ Create exercise** inside an exercise picker to save and select a new exercise without leaving the editor; the same action is available during training.
4. Select **Use this program** / **Apply to this week**.
5. In **Overview**, start a workout. Start any exercise, then start a set.
6. Starting a set prefills its own completed weight from the previous run of the same workout template. Warm-up and working sets keep separate weights, including separate working sets. New sets, changed set types and sets without a completed match in that previous workout start empty. Change it as needed, enter actual reps, and complete the set. Rest starts automatically; the next set or **End rest** ends it.
7. Complete exercises, or explicitly skip unused sets. Finish the workout to add it to history.
8. Correct recorded results in **History**; view exercise records via **Progress**.

A paused or active workout can always be recovered from Overview after reloading. Only one unfinished workout is allowed. One exercise and one set can be active at a time; finish/skip a running set before switching exercises.

## Timing and statistics

- Training weeks start **Monday 03:00 Europe/Amsterdam**, including DST. No scheduled reset job is needed.
- A session belongs to the week in which it was started; rollover never moves or deletes it. **Repeat** creates another workout but does not satisfy an assignment twice.
- Pause freezes active duration and rest countdown. Actual rest excludes explicit workout pauses; history also shows wall time. Backgrounding is not a pause.
- Volume is **entered kg × entered reps**, including warm-ups, from completed sets in completed workouts. Dumbbell weight is per dumbbell; unilateral reps are per side. No implicit doubling is applied.
- PRs exclude warm-ups. Heaviest recorded load is measured; Epley estimated 1RM is explicitly labelled and limited to 1–10 reps (one rep uses recorded weight).
- Abandoned workouts retain all records but do not contribute to dashboard totals or records.
- Templates do not prescribe kilograms. Prefilled weight is an editable draft, not a recorded result or a progression recommendation. The source is the most recent finished run of the same template (including abandoned runs); only its completed, non-removed matching sets qualify. There is no fallback to today’s other sets or older workouts. Set identity survives template saves and reordering. Session-only added sets have no template history. Editing a historical result affects subsequent prefills, while already-started sets retain their starting suggestion. Legacy sessions are linked only where exercise and set structure can be matched; uncertain matches remain empty.
- All confirmed state changes are server-persisted. Offline actions are labelled unconfirmed and require manual retry. A command ID makes a retry safe even if the server saved the original request but its response was lost. Local set drafts are not server records.

## PWA

On iPhone Safari, use Share → Add to Home Screen. Production requires HTTPS. The manifest, icons, standalone layout and offline fallback are included. The service worker does not cache private workout responses. Foreground sound requires a user gesture; vibration depends on device support. Background alarms are not guaranteed. Real-device iPhone validation remains part of deployment acceptance.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Tests use temporary databases and an isolated local test account, never your training database. Browser tests cover authoring, training, refresh recovery, rest/pause, historical corrections, offline retry, a lost write response and competing commands. See [verification notes](docs/verification.md).

## Operations

```sh
pnpm backup
# Or choose a destination:
pnpm backup /path/to/private/backups/auctus.db
```

Backups use SQLite's online backup API and verify database and foreign-key integrity. Store an encrypted copy off the VPS. A backup on the same disk alone does not protect against host loss.

See [deployment and recovery](docs/deployment.md), the [approved architecture](tasks/plan.md), and [delivery checklist](tasks/todo.md). VPS configuration is intentionally pending host details; the app must not replace unrelated proxy/services.
