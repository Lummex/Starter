#!/usr/bin/env bash
# Runs the Phase A database tests on a throwaway local PostgreSQL (no Docker, no Supabase).
# Usage: PG_BIN=/path/to/postgres/bin bash supabase/tests/run-local.sh
# Uses the local shim to stand in for Supabase's auth schema. The factory instead
# runs run-supabase.sh against a real local Supabase (supabase start).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
bin="${PG_BIN:+$PG_BIN/}"
work="$(mktemp -d)"
port="${PG_PORT:-55432}"
trap '"${bin}pg_ctl" -D "$work/db" stop -m fast >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

"${bin}initdb" -D "$work/db" -U postgres -A trust >/dev/null
"${bin}pg_ctl" -D "$work/db" -o "-p $port -c listen_addresses=127.0.0.1" -l "$work/pg.log" -w start >/dev/null
psql=("${bin}psql" -h 127.0.0.1 -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${psql[@]}" -f "$here/local-shim/supabase-auth-shim.sql"
for m in "$root"/migrations/*.sql; do
  echo "migration: $(basename "$m")"
  "${psql[@]}" -f "$m"
done
echo "seed: seed.sql"
"${psql[@]}" -f "$root/seed.sql"
echo "tests:"
"${psql[@]}" -f "$here/phase_a_security.test.sql"
