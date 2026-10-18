# Auctus

A private workout journal with master-managed accounts: manually authored programs, weekly assignments, persistent live workouts, planned/actual rest, editable history and exercise progression. Built with Next.js, strict TypeScript, SQLite/Drizzle and Better Auth.

## Local setup

Use Node **24 LTS** and pnpm **11.25.0**. With nvm, run `nvm install && nvm use`. Corepack or `npm install -g pnpm@11.25.0` supplies pnpm.

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm db:migrate
pnpm run owner
pnpm dev
```

`pnpm run setup` creates a private, ignored `.env.local` containing a random authentication secret. `pnpm run owner` prompts for your email and a hidden password (12–128 characters). Re-running it changes the master credentials and revokes that account’s sessions; member accounts and enrolled passkeys are preserved. Use the explicit `run`: `pnpm owner` is pnpm’s registry-owner command, not this application’s setup script. No public signup exists. Open [localhost:3105](http://localhost:3105). Use this hostname for local passkeys; an IP address is not a supported passkey relying-party ID.

Your data lives at `data/auctus.db`, outside Git. Never delete this directory to update the app. Set `DATABASE_PATH` to another local persistent path if needed. The canonical `BETTER_AUTH_URL` must match the origin you open, including the port.

## Accounts and master passkey

The existing owner becomes the single master account. Sign in with its email and password, then choose **Create passkey** and confirm on your device (Face ID, Touch ID, device PIN, or a security key). First enrollment requires a password login from the last five minutes. Training data and administration remain locked until enrollment succeeds. Later sign-ins require the password **and** an enrolled passkey. Localhost and the production domain have separate passkeys.

After unlocking, use **Settings → Manage accounts** to create member accounts. Creating an account also requires your current master password. Members cannot create accounts, assign roles, access master controls, or read another account’s exercises, programs, sessions or history. There is no public signup. Drafts, pending saves, scheduling, command receipts, active workouts and push delivery are account-scoped.

Use **Add a backup passkey** while signed in and verified to enroll another device/key. If all master passkeys are lost, recovery requires trusted terminal/SSH access:

```sh
node --env-file-if-exists=.env.local --import tsx scripts/reset-passkeys.ts
```

This interactive command backs up the database, requires an explicit confirmation phrase, removes master passkeys and revokes master sessions. It does not change passwords or member accounts. There is no web reset endpoint. The ordinary owner command resets the password without removing passkeys.

## First workout

1. Add exercises in **Library**.
2. Create a program in **Programs** and open it.
3. Add workouts, ordered exercises, set types, minimum/maximum reps and rest times. For 6–8 reps, enter minimum 6 and maximum 8; for an exact target, use the same number in both fields. Type in **Search exercises** to filter the custom menu by name, then select a result and add it. For a new name, choose **+ Add “name”** to open the creation dialog with your search prefilled. This works in workout templates, during training, and in Library search. With an empty search, **+ Create exercise** opens a blank dialog.
   Use the document icon on an exercise to save current workout changes and collapse its fields. Use the pencil icon to reopen it. **Save workout** saves and returns to the workout list.
4. Select **Use this program** / **Apply to this week**.
5. In **Overview**, start a workout. Start any exercise, then start a set.
6. Starting a set prefills its own completed weight from the previous run of the same workout template. Warm-up and working sets keep separate weights, including separate working sets. New sets, changed set types and sets without a completed match in that previous workout start empty. Change it as needed, enter actual reps, and complete the set. Rest starts automatically; the next set or **End rest** ends it.
7. Complete exercises, or explicitly skip unused sets. Finish the workout to add it to history.
8. Correct recorded results in **History**; view exercise records via **Progress**.

A paused or active workout can always be recovered from Overview after reloading. Only one unfinished workout is allowed per account. One exercise and one set can be active at a time; finish/skip a running set before switching exercises.

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

Production runs at [auctus.ammarhadid.com](https://auctus.ammarhadid.com) on `nexo-vps`, using the existing `/srv/apps`, `/srv/data` and shared Caddy layout. The VPS has a fresh owner account and database; local workouts were not copied. Daily verified backups run at 03:40 UTC. See [deployment and recovery](docs/deployment.md) for exact paths, update commands, backups and rollback, the [approved architecture](tasks/plan.md), and [delivery checklist](tasks/todo.md).

The rest timer stays fixed at the top during training. Pause/Resume freezes only its countdown; +5s and +15s extend the current rest without changing the template. Timer controls persist across refreshes. Actual rest continues to measure recovery time, excluding workout pauses.

Rest alerts: use **Test sound** in the timer or Settings to enable and preview the three-tone chime. The preference is remembered; browser audio still requires a user gesture after page reload. For iPhone background notifications, deploy to HTTPS, add Auctus to the Home Screen, then enable background alerts in Settings. The persistent Node server schedules pushes automatically; a sleeping/serverless host will not. iOS controls notification sound and haptics, so this is not a guaranteed native alarm. See [iPhone research and setup](docs/research/iphone-rest-alerts.md).
