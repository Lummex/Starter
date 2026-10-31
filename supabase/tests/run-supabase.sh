#!/usr/bin/env bash
# Runs the Phase A database tests against a REAL local Supabase (Docker), the
# way the factory does it in GitHub Actions. Never points at the real project.
# Usage (repo root): bash supabase/tests/run-supabase.sh
# Needs: Docker, the Supabase CLI (supabase/setup-cli in Actions) and psql.
set -euo pipefail
cd "$(dirname "$0")/../.."

supabase start -x vector,logflare,edge-runtime >/dev/null
supabase db reset --local          # applies every migration, then seed.sql
db_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"   # local-only default, not a secret

case "$db_url" in *127.0.0.1*|*localhost*) ;; *) echo "refusing: not a local database"; exit 1 ;; esac
psql "$db_url" -v ON_ERROR_STOP=1 -q -f supabase/tests/phase_a_security.test.sql
