# Deployment and recovery

Status: deployment package prepared. No VPS has been accessed or changed. Confirm host OS, CPU architecture, RAM/disk, Docker/Compose, reverse proxy, subdomain/DNS, SSH access and backup destination before applying host-specific configuration.

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

Use unique timestamped filenames for retention. Schedule the command on the host after agreeing the backup destination; recommended initial policy is daily backups, a backup before every migration, seven daily and four weekly copies. Send an encrypted copy to a separate host/storage destination, and monitor failed backups. No backup schedule has been installed yet.

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
