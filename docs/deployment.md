# Deployment and recovery

For the existing production installation on `nexo-vps`, follow [nexo-vps-deployment.md](nexo-vps-deployment.md). It is the authoritative runbook for updates and checks. The instructions below are for a **new generic installation** or recovery background; do not use their unqualified Compose commands on `nexo-vps`.

The original Auctus deployment replaced a legacy application on 18 October 2026. The legacy source, configuration, images, and MongoDB exports were retained under `/srv/backups/auctus/legacy-2026-10-18`. Legacy recovery is a separate whole-application operation: preserve the current Auctus database first, restore only the former Auctus proxy blocks, and do not replace the shared Caddyfile or alter other services.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file on persistent local disk; container default `/app/data/auctus.db` |
| `BETTER_AUTH_URL` | Exact canonical origin, e.g. `https://auctus.example.com` |
| `BETTER_AUTH_SECRET` | At least 32 random characters; generate with `openssl rand -base64 48` |
| `PORT` | Application port; container uses 3000 |

Use a private `.env` file for Compose (mode 600) or a host secret manager. Do not commit it. `pnpm run setup` generates `.env.local` for local development only; its HTTP origin is not a production setting. Keep the auth secret stable across restarts and do not put it in browser-visible variables.

## Build and boot

The supplied Dockerfile runs tests, typechecking, lint and a production build; it runs as the non-root `node` user. Build on the target architecture or explicitly use Docker buildx for that architecture. Native SQLite binaries cannot be copied from macOS to Linux.

```sh
docker compose build
docker compose up -d
docker compose exec auctus node --import tsx scripts/owner.ts
docker compose ps
curl --fail http://127.0.0.1:3101/api/health
```

The owner command is interactive and hides password entry. The application exposes only a loopback HTTP port on the host. SQLite has no TCP service and is stored in the named `auctus-data` volume. Never use `docker compose down -v` on a live installation: it removes the training data volume.

Migrations run before each application start, transactionally, with checksums and an applied-version ledger. Re-running is safe; modifying an already-applied migration is rejected. Use a new migration for future changes. Only one app instance should run against this database.

## HTTPS and reverse proxy

Use the VPS's existing proxy. Adapt the one-site examples in `deploy/` after checking existing configuration. They are examples, not ready-to-run certificate or DNS provisioning commands.

- Point the dedicated DNS record at the VPS; verify propagation before requesting certificates.
- Terminate HTTPS at the proxy, forward the original host/protocol, and disable buffering for streamed responses.
- Ensure public access cannot bypass the proxy to reach port 3101.
- Limit request bodies to 512 KB. Login rate limiting is enforced in the database and survives application restarts.
- Add HSTS on this subdomain after HTTPS works. Do not change unrelated services or apply a blanket host-wide policy.
- Set `BETTER_AUTH_URL` to that exact HTTPS origin. Verify Secure, HttpOnly, SameSite cookies and rejected foreign-origin mutations.

If the proxy itself runs in Docker, its network cannot normally reach host loopback. Use a dedicated private Docker network between proxy and app, remove host port publication, and point the proxy at `auctus:3000`; determine the actual existing network before changing Compose.

## Backups

A consistent live backup must use SQLite's backup API, not a copy of only the main database while WAL is active.

```sh
docker compose exec -T auctus node --import tsx scripts/backup.ts /app/data/backups/daily.db
```

Use unique timestamped filenames for retention. The existing VPS schedule is recorded in [nexo-vps-deployment.md](nexo-vps-deployment.md); other installations must configure their own. Take an additional backup before every migration. Send an encrypted copy to a separate host/storage destination, and monitor failed backups.

Restore drill: restore a recent backup to a separate directory/database, run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, start a disposable app instance against it, and verify a known workout and set count. Never test a restore by overwriting the live database.

## Updates and rollback

1. Take and verify a backup and retain the current application image/tag.
2. Build/test the new image. Stop the app before a migration requiring exclusive operational access.
3. Start the new version; startup applies migrations before serving traffic.
4. Check health, sign-in, current workout recovery, history, and a safe test write.
5. Retain backup/image until acceptance succeeds.

An old binary is not guaranteed to understand a newer schema. Rollback may need both the previous application image and a matching database backup. Database restoration discards writes made after that backup; export/preserve the newer database first and make this decision deliberately.

For restoration: stop the app; preserve the current database and its `-wal`/`-shm` companions together in a separate recovery location; replace the stopped database with the verified backup; ensure the replacement has no stale WAL/SHM companions; set owner UID/GID to match the container's node user; then restart the matching app version. Do not remove the preserved recovery copy until verification succeeds. Use host-specific volume paths discovered on the VPS rather than guessing Docker's internal directories.

## Restart and diagnostics

```sh
docker compose restart auctus
docker compose logs --tail=100 auctus
docker compose ps
```

The restart policy recovers the process after Docker/host restart. Ensure Docker starts at boot. Logs avoid credentials and request bodies. Check disk space, volume permissions, canonical origin and migration errors first if startup fails. Never resolve a migration failure by deleting the database.

## Final deployment acceptance

- [ ] DNS and certificate valid; HTTP redirects to HTTPS.
- [ ] Only intended proxy entry points are publicly reachable.
- [ ] Private owner can sign in; unauthenticated APIs and public signup are blocked.
- [ ] Create a program, log/finish a workout and edit a result; statistics match.
- [ ] Restart the app and confirm records and an interrupted workout survive.
- [ ] Back up, restore separately, and compare known records.
- [ ] Install on a real iPhone; test standalone safe areas, reload/background recovery and audio opt-in.
- [ ] Verify a Monday 03:00 transition with deterministic tests; no destructive weekly reset exists.
- [ ] Confirm backup schedule/destination and document the deployed commit/image.

## Master passkey and member provisioning

Migration 0010 converts the existing owner to the single master and assigns all existing records to that account. Migration 0011 adds passkeys and per-session verification. Pre-update master sessions cannot access private data until passkey verification; first enrollment requires a fresh password sign-in. The production passkey is bound to `auctus.ammarhadid.com`. The local development instance uses `localhost:3105` and needs separate enrollment.

After the master completes device enrollment, Settings → Manage accounts permits member creation with a fresh password confirmation. No public signup or role promotion endpoint exists. The master can list accounts but cannot browse another account’s workouts. The dedicated test member has the same separately stored credentials on local and VPS databases; its training data remains independent in each database.

Lost-passkey recovery requires SSH and an interactive command:

```sh
cd /srv/apps/auctus
docker compose -f docker-compose.yml exec auctus node --import tsx scripts/reset-passkeys.ts
```

The command takes a database backup, requires the phrase `RESET MASTER PASSKEYS`, revokes master sessions and deletes master passkeys. Sign in with the existing password to enroll again. `scripts/owner.ts` resets only the master password and sessions, keeping passkeys. Neither recovery operation is exposed over HTTP. Backups contain account credentials and authentication material and must remain private.

Account release acceptance: the final image passed all 47 tests, typecheck, lint, build and the disposable restart/backup/restore drill on Linux. The stopped pre-migration database is retained at `/srv/backups/auctus/sqlite/pre-accounts-final-2026-10-19.db`; the matching previous image is `auctus:before-accounts-2026-10-19`. Production had no training records at migration; local migration preserved all 69 existing training rows. Both master accounts were preserved. The dedicated member signs in locally and through public HTTPS in desktop Chromium and mobile WebKit, starts with empty training data, and receives 403 for account administration. The production master’s existing password was accepted, but all private APIs remained blocked pending passkey enrollment. No real master passkey was created by automation. The owner must complete that step on their own device. Unrelated container IDs remained unchanged.
