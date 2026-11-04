#!/usr/bin/env bash
# DSH Home backup script — rsync + SQLite VACUUM INTO consistent snapshots.
# Run: ./scripts/backup-dsh.sh
# Cron: 0 3 * * * /Users/yi/YrY/deepseek-harness/scripts/backup-dsh.sh
set -euo pipefail

: "${DSH_HOME:="$HOME/.dsh"}"
: "${BACKUP_ROOT:="$HOME/.dsh-backups"}"
: "${RETENTION_COUNT:=7}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
LOCK_DIR="$BACKUP_ROOT/.backup.lock"
LOG_FILE="$BACKUP_ROOT/backup.log"

# ── Lock (mkdir is atomically portable, no flock dependency) ─────────────
mkdir -p "$BACKUP_ROOT"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date -u +%H:%M:%SZ)] backup-dsh: another backup is running, exiting"
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

exec >> "$LOG_FILE" 2>&1
echo "─── backup-dsh $TIMESTAMP ───"

# ── Pre-flight ────────────────────────────────────────────────────────────
if [[ ! -d "$DSH_HOME" ]]; then
  echo "ERROR: DSH_HOME '$DSH_HOME' does not exist"
  exit 1
fi

DSH_SIZE=$(du -sh "$DSH_HOME" 2>/dev/null | cut -f1)
echo "source: $DSH_HOME ($DSH_SIZE)"

# ── Phase 1: rsync (sessions, storages, attachments, logs, credentials) ──
echo "--- rsync ---"
mkdir -p "$BACKUP_DIR/dsh"

rsync -a \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-wal' \
  --exclude '*.sqlite-shm' \
  --exclude '.backup.*' \
  --delete \
  "$DSH_HOME/" "$BACKUP_DIR/dsh/"

RSYNC_RC=$?
if [[ $RSYNC_RC -ne 0 ]]; then
  echo "ERROR: rsync failed with exit code $RSYNC_RC"
  exit 1
fi
echo "rsync: OK"

# ── Phase 2: SQLite VACUUM INTO consistent snapshots ─────────────────────
echo "--- sqlite ---"

vacuum_db() {
  local src="$1"
  local basename
  basename=$(basename "$src")
  local dst="$BACKUP_DIR/dsh/bot/$basename"

  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    sqlite3 "$src" "VACUUM INTO '$dst'"
    # portable stat: macOS uses -f%z, Linux uses -c%s
    local src_size dst_size
    src_size=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src" 2>/dev/null || echo 0)
    dst_size=$(stat -f%z "$dst" 2>/dev/null || stat -c%s "$dst" 2>/dev/null || echo 0)
    echo "  $basename: ${src_size}B → ${dst_size}B"
  else
    echo "  $basename: SKIP (not found)"
  fi
}

vacuum_db "$DSH_HOME/bot/usage.sqlite"
vacuum_db "$DSH_HOME/bot/chat-index.sqlite"

# Remove any stale rsync'd sqlite files that VACUUM INTO replaced
rm -f "$BACKUP_DIR/dsh/bot/usage.sqlite-wal" \
      "$BACKUP_DIR/dsh/bot/usage.sqlite-shm" \
      "$BACKUP_DIR/dsh/bot/chat-index.sqlite-wal" \
      "$BACKUP_DIR/dsh/bot/chat-index.sqlite-shm"

echo "sqlite: OK"

# ── Phase 3: Integrity summary ───────────────────────────────────────────
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
SESSION_COUNT=$(find "$BACKUP_DIR/dsh/sessions" -name 'session.v*.jsonl*' 2>/dev/null | wc -l | tr -d ' ')
echo "result: $BACKUP_DIR ($BACKUP_SIZE, $SESSION_COUNT session files)"

# ── Phase 4: Rotation — keep RETENTION_COUNT newest ──────────────────────
echo "--- rotate (keep $RETENTION_COUNT) ---"
total=0
while IFS= read -r dir; do
  total=$((total + 1))
  if [[ $total -gt $RETENTION_COUNT ]]; then
    echo "  purge: $dir"
    rm -rf "$dir"
  fi
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*T*Z' | sort -r)
echo "rotate: OK (kept $([ $total -gt $RETENTION_COUNT ] && echo "$RETENTION_COUNT" || echo "$total")/$total backups)"

echo "─── done $(date -u +%H:%M:%SZ) ───"
echo ""