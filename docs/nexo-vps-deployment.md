# Auctus on `nexo-vps`

Use this runbook when the user asks to deploy, update, diagnose, or roll back the existing Auctus installation. The public origin is `https://auctus.ammarhadid.com`. This VPS also hosts unrelated services; change only Auctus. Routine deployment uses the existing `ssh nexo-vps` alias as `ammar` and does not need root. If access or required privileges fail, ask for the missing access instead of modifying shared host configuration.

## Live layout

- Checkout: `/srv/apps/auctus`. Inspect its branch and commit; do not assume GitHub's `main` is deployed. The production branch was `codex/auctus-mvp` when this runbook was written.
- VPS Compose file: `/srv/apps/auctus/docker-compose.yml`. Always pass `-f docker-compose.yml`; the repository's `compose.yaml` is for generic installations. The VPS checkout has no configured Git remote, so fetch by the explicit GitHub URL below.
- Only Compose service/container: `auctus`; image tag: `auctus:production`. Its SQLite data lives at `/srv/data/auctus/current/database/auctus.db`, mounted at `/app/data/auctus.db`. Private environment: `/srv/data/auctus/current/app.env`. Do not print or copy private configuration into logs or commits.
- Backups: `/srv/backups/auctus/sqlite`. `./deploy/backup-nexo-vps.sh` makes and verifies a consistent online SQLite backup. A daily backup is scheduled at 03:40 UTC in `ammar`'s crontab; verified snapshots are kept for 14 days and failures are logged at `/srv/backups/auctus/backup.log`. The `auctus` Docker network connects the app to the existing Caddy proxy; routine app updates do not touch Caddy or other containers.

## Before changing production

1. Confirm deployment is authorized for this task; a user request to deploy already supplies that authorization. Finish local checks and commit the intended work. Push the commit to the branch intended for production. If work was done on another branch, integrate it into the VPS deployment branch first. Record the exact pushed SHA.
2. Inspect the live state over `ssh -o BatchMode=yes nexo-vps`: `cd /srv/apps/auctus`; check `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `docker compose -f docker-compose.yml ps`, and `docker ps --format '{{.ID}} {{.Names}}'`. Record the current Auctus image ID and unrelated container IDs. Confirm `https://auctus.ammarhadid.com/api/health` responds successfully. Stop if the checkout is dirty, the branch/ref is unexpected, or the service is unhealthy; investigate before updating.
3. Run `./deploy/backup-nexo-vps.sh` from the VPS checkout. Confirm its reported backup exists and is nonempty under `/srv/backups/auctus/sqlite`. Tag the current image for rollback with a unique descriptive tag, for example `docker image tag auctus:production auctus:before-<change>-<date>`, then verify the tag's image ID. Keep the matching commit SHA and backup path in the deployment notes.

## Deploy an application change

Run the following from `/srv/apps/auctus` on `nexo-vps`. Set `deployment_branch` to the branch observed on the VPS and `expected_sha` to the pushed commit. The Dockerfile runs tests, type checking, lint, and the production build. The live container stays on the old image during `build`.

```sh
deployment_branch='codex/auctus-mvp' # Replace if the deployed branch has changed.
expected_sha='SHA_FROM_PUSH'
GIT_TERMINAL_PROMPT=0 git fetch --no-tags https://github.com/Ammar-Hadid/Auctus.git "refs/heads/$deployment_branch"
test "$(git rev-parse FETCH_HEAD)" = "$expected_sha"
git merge-base --is-ancestor HEAD FETCH_HEAD
git diff --stat HEAD FETCH_HEAD
git diff --name-only HEAD FETCH_HEAD
git merge --ff-only FETCH_HEAD
docker compose -f docker-compose.yml build auctus
docker compose -f docker-compose.yml up -d --no-build --no-deps auctus
```

Review the file list and commit range before merging. If fast-forward is impossible or the diff includes unexpected work, integrate locally and push a new verified commit; do not reset or force checkout the VPS. If the build fails, leave the running container untouched and fix the source. For a **documentation-only** commit, inspect, push, and fast-forward the clean VPS checkout; backup, image tagging, Docker build, and container restart are unnecessary because the runtime and database do not change.

## Verify and recover

After switching, check that the VPS checkout is clean and at the expected SHA, the container is `running` and `healthy` on the new image, and the Auctus logs show a normal startup. Read the live SQLite database in read-only mode; integrity must be `ok` with zero foreign-key violations:

```sh
git status --short
git rev-parse HEAD
docker inspect auctus --format '{{.Image}} {{.State.Status}} {{.State.Health.Status}}'
docker compose -f docker-compose.yml logs --tail=100 auctus
docker exec auctus node -e 'const DB=require("better-sqlite3"); const db=new DB("/app/data/auctus.db",{readonly:true,fileMustExist:true}); console.log(db.pragma("integrity_check",{simple:true}),db.pragma("foreign_key_check").length); db.close()'
docker ps --format '{{.ID}} {{.Names}}'
```

Check the public health and login URLs from outside the VPS. Compare unrelated container IDs with the pre-deployment snapshot; they must be unchanged. Verify the backup and rollback image remain available. For user-facing changes, run the relevant authenticated flow on a disposable local test database; production read-only health checks do not prove that flow. iPhone safe areas, push, sound, and haptics need acceptance on a physical device.

If the new container fails, preserve logs and the current database before changing anything else. For a code-only rollback with no schema change, tag the retained image as `auctus:production` and recreate only `auctus` with `docker compose -f docker-compose.yml up -d --no-build --no-deps auctus`. Repeat health checks, then restore the matching source state with a normal revert commit on the deployment branch; do not reset shared history. A migration can make an old image incompatible with the new database. Restoring a backup would discard later writes, so preserve the current database and get an explicit recovery decision before a database restore. Never remove the Auctus data volume. See [deployment.md](deployment.md) for schema and legacy recovery background.

Report the deployed commit, checks performed, backup/rollback reference, and any unverified behavior. Keep credentials and database contents out of the report.
