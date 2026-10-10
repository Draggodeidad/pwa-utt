#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
required=(
  src/lib/device/camera.ts
  src/lib/device/geolocation.ts
  src/lib/notifications/client.ts
  docs/capabilities.md
  tests/capabilities.spec.ts
  tests/helpers/capabilities-camera.ts
  tests/helpers/capabilities-geolocation-notifications.ts
  README.md
  evidence/individual.md
)
missing=0
for file in "${required[@]}"; do
  if [[ ! -s "$file" ]] || ! grep -q '[^[:space:]]' "$file"; then
    printf 'W06_MISSING_OR_EMPTY: %s\n' "$file" >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then exit 1; fi
# Parse the script: a reference in documentation is not test registration.
node - <<'JS'
const { scripts } = require('./package.json');
const commands = scripts?.test?.split('&&').map(command => command.trim()) ?? [];
if (!commands.includes('node tests/capabilities.spec.ts')) {
  console.error('W06_TEST_NOT_REGISTERED: node tests/capabilities.spec.ts');
  process.exit(1);
}
JS
echo W06_PUBLIC_OK
