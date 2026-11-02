#!/usr/bin/env bash
# Structural W10 checks only. Behavioral acceptance is a separate smoke gate.
set -euo pipefail
cd "$(dirname "$0")/.."
node --input-type=module - "${1:---artifacts}" <<'NODE'
import { readFileSync, statSync } from 'node:fs';
const mode = process.argv[2];
const groups = {
  '--artifacts': ['Dockerfile', 'docs/release-process.md', 'docs/runbook.md',
    'tests/smoke.spec.ts', '.github/workflows/academic-evaluation.yml',
    '.github/workflows/week-10-w10-release-rollback.yml'],
  '--documents': ['README.md', 'evidence/individual.md', 'docs/w10-evaluation.md'],
};
if (!Object.hasOwn(groups, mode)) throw new Error('Use --artifacts or --documents');
let failed = false;
for (const path of groups[mode]) {
  try {
    if (!statSync(path).isFile() || !readFileSync(path, 'utf8').trim()) throw new Error();
  } catch {
    console.error(`W10 missing/empty file: ${path}`);
    failed = true;
  }
}
if (mode === '--artifacts') {
  try {
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
    if (scripts?.['test:smoke'] !== 'node tests/smoke.spec.ts') throw new Error();
  } catch {
    console.error('W10 requires test:smoke = node tests/smoke.spec.ts');
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`W10 ${mode}: files present; content/behavior and human evidence remain separate.`);
NODE
