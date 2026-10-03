#!/usr/bin/env bash
set -euo pipefail

# The kit's chained `test ... && ...` reports PUBLIC_OK when an artifact is
# absent under Bash's errexit rules. Check each required deliverable explicitly.
required=(
  src/lib/sync/queue.ts
  src/lib/storage/schema.ts
  src/lib/sync/conflict-policy.ts
  docs/sync-policy.md
  tests/sync.spec.ts
)
for file in "${required[@]}"; do
  if [[ ! -s "$file" ]]; then
    printf 'W05_MISSING_OR_EMPTY: %s\n' "$file" >&2
    exit 1
  fi
done

# A present test file is not sufficient if the normal test command omits it.
if ! rg -Fq 'tests/sync.spec.ts' package.json; then
  echo 'W05_TEST_NOT_REGISTERED: tests/sync.spec.ts' >&2
  exit 1
fi

echo W05_PUBLIC_OK
