#!/bin/sh
set -eu
# Run as ammar. SQLite's online backup API captures the WAL consistently.
exec 9>/srv/backups/auctus/backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
docker exec auctus node --import tsx scripts/backup.ts "/app/backups/auctus-$stamp.db"
# Only prune this job's verified SQLite snapshots, never replacement archives.
find /srv/backups/auctus/sqlite -maxdepth 1 -type f -name 'auctus-*.db' -mtime +14 -delete
