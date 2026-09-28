#!/usr/bin/env bash
set -euo pipefail
test -e 'public/manifest.webmanifest'
test -e 'src/app/layout.tsx'
test -e 'src/app/page.tsx'
test -e 'src/components/app-shell.tsx'
test -e 'tests/manifest.spec.ts'
test -e 'src/app/inspecciones/page.tsx'
test -e 'src/app/inspecciones/[id]/page.tsx'
test -e 'src/components/loading-state.tsx'
test -e 'docs/rendering-decision.md'
test -e 'tests/rendering.spec.ts'
test -f README.md
node scripts/verify.mjs --structure
echo PUBLIC_OK
