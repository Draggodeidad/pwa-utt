#!/usr/bin/env bash
# Local disposable PostgreSQL, simulated Auth/Storage. Never calls Supabase remote.
set -euo pipefail
cd "$(dirname "$0")/.."
container="pwa-coordination-test-$$"
logs=$(mktemp -d)
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$logs"; }
trap cleanup EXIT
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in {1..40}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.25
done
docker exec "$container" mkdir -p /work/supabase
docker cp supabase/tests "$container":/work/supabase/tests >/dev/null
docker cp supabase/migrations "$container":/work/supabase/migrations >/dev/null
apply() {
  if ! docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -f "/work/$1" > "$logs/output" 2>&1; then
    cat "$logs/output"; return 1
  fi
  echo "PASS SQL: $1"
}
apply supabase/tests/photo-local-bootstrap.sql
for migration in supabase/migrations/*.sql; do
  if [[ "$migration" == *20261010010000_coordination_lifecycle.sql ]]; then
    apply supabase/tests/coordination-upgrade.sql
  else
    apply "$migration"
  fi
done
apply supabase/tests/coordination-lifecycle.sql
apply supabase/tests/photo-module-smoke.sql
apply supabase/tests/inspection-locations.sql
apply supabase/tests/operation-replay-ack.sql
python3 tests/helpers/coordination-concurrency.py "$container"
