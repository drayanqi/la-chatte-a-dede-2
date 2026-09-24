#!/bin/sh
# Nightly + pre-migrate database backup (story 6.5).
#
# One script, one directory, one retention rule: both the Ansible cron
# (03:30 nightly) and the CI deploy's pre-migrate step call this. It dumps
# ALL databases from the mysql container and keeps the 7 newest *.sql.gz
# in /home/debian/lachatadede/backups/ regardless of prefix.
#
# Runs as `debian` on the box (docker group member); must be invoked from
# anywhere — it resolves its own directory so the compose project (.env,
# docker-compose.yml) is the one living next to it.
#
# Safety properties:
# - the root password is read INSIDE the container ($MYSQL_ROOT_PASSWORD
#   from the container env), so it never appears in host process listings
#   or cron logs;
# - --single-transaction gives a consistent InnoDB dump without locking —
#   the app stays up during the dump (do NOT add --lock-all-tables);
# - the dump lands as *.sql.gz.part and is renamed only after the pipeline
#   succeeded AND the file is non-empty — a failed or empty dump can never
#   occupy a retention slot (an empty file that prunes real backups is
#   worse than a failed backup);
# - any failure prints to stderr and exits nonzero (the cron appends both
#   streams to backups/cron.log; the deploy's script_stop aborts the gate).
set -eu

cd "$(dirname "$0")"

BACKUPS_DIR=../backups
mkdir -p "$BACKUPS_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
PART="$BACKUPS_DIR/all-$STAMP.sql.gz.part"
FINAL="$BACKUPS_DIR/all-$STAMP.sql.gz"

cleanup() {
    if [ -e "$PART" ]; then
        rm -f "$PART"
    fi
}
trap cleanup EXIT

if ! docker compose exec -T mysql sh -c 'exec mysqldump --all-databases -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction' | gzip > "$PART"; then
    echo "backup.sh: mysqldump pipeline failed" >&2
    exit 1
fi

if [ ! -s "$PART" ]; then
    echo "backup.sh: dump is empty, refusing to keep it" >&2
    exit 1
fi

mv "$PART" "$FINAL"

# Retention: keep the 7 newest *.sql.gz in the directory, regardless of
# prefix (nightly all-* and pre-migrate dumps share one rule). Guarded so
# an empty directory is not an error.
for old in $(ls -1t "$BACKUPS_DIR"/*.sql.gz 2>/dev/null | tail -n +8); do
    rm -f "$old"
done

echo "backup.sh: wrote $FINAL"
