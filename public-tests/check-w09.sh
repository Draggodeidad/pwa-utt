#!/usr/bin/env bash
# Structural/registration contract only; behavioral security is test:security.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo 'W09: falta Node' >&2; exit 1; }
command -v git >/dev/null || { echo 'W09: falta Git' >&2; exit 1; }
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSecurityHeaders } from './src/lib/security/headers.mjs';
import config from './next.config.mjs';
const required = [
  'docs/threat-model.md', 'docs/privacy-data-inventory.md', 'docs/w09-baseline.md',
  'src/lib/security/validation.ts', 'src/lib/security/config.ts', 'src/lib/security/headers.mjs',
  'public/robots.txt', 'tests/security.spec.ts', 'scripts/verify-w09.mjs',
  '.github/workflows/week-09-w09-security-privacy.yml', 'README.md',
];
let failures = 0;
for (const path of required) {
  try { assert.ok(readFileSync(path, 'utf8').trim().length > 0); }
  catch { failures++; console.error(`W09: ausente/vacío ${path}`); }
}
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:security'], 'node tests/security.spec.ts');
  assert.equal(pkg.scripts['verify:w09'], 'node scripts/verify-w09.mjs');
  const entries = await config.headers();
  assert.deepEqual(entries, [{ source: '/:path*', headers: getSecurityHeaders({ production: process.env.NODE_ENV === 'production' }) }]);
  for (const [path, module] of [
    ['src/lib/supabase/server.ts', '@/lib/security/config'],
    ['src/lib/api/inspection-http.ts', '@/lib/security/validation'],
    ['src/lib/api/finding-http.ts', '@/lib/security/validation'],
    ['src/app/api/photos/[id]/route.ts', '@/lib/security/validation'],
  ]) assert.ok(readFileSync(path, 'utf8').includes(`from "${module}"`));
  assert.equal(readFileSync('public/robots.txt', 'utf8'), 'User-agent: *\nDisallow: /\n');
  assert.ok(readFileSync('README.md', 'utf8').includes('verify:w09'));
} catch { failures++; console.error('W09: contrato de contenido/consumidores/registro incumplido'); }
console.log(`W09 gate: ${failures ? 'FAIL' : 'PASS'}. No acredita comportamiento ni ausencia exhaustiva de secretos.`);
process.exitCode = failures ? 1 : 0;
JS
