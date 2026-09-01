#!/usr/bin/env node

/**
 * Development Kit - Antigravity-aware documentation validation.
 *
 * Public /dk-* workflow entries are implemented as Antigravity-native skill
 * adapters so they appear in Antigravity slash-command discovery. They are
 * transport adapters for canonical commands/*.md workflows, not additional
 * engineering skills, so they are intentionally documented by the command
 * reference pages rather than duplicate skill reference pages.
 */

import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocs } from '../../scripts/validate-docs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function isAntigravityWorkflowAdapter(relativePath) {
  const normalized = relativePath.split(sep).join('/');
  return /^skills\/dk-[^/]+(?:\/|$)/.test(normalized);
}

function shouldCopy(sourcePath) {
  const rel = relative(ROOT, sourcePath);
  if (!rel) return true;

  const normalized = rel.split(sep).join('/');
  if (normalized === '.git' || normalized.startsWith('.git/')) return false;
  if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) return false;
  if (isAntigravityWorkflowAdapter(rel)) return false;
  return true;
}

const tempParent = mkdtempSync(join(tmpdir(), 'dk-docs-antigravity-'));
const validationRoot = join(tempParent, 'repository');

try {
  cpSync(ROOT, validationRoot, {
    recursive: true,
    filter: shouldCopy,
  });

  console.log('=== Development Kit Documentation Validator ===');
  console.log('Antigravity /dk-* workflow skill adapters are covered by command references.');

  const result = validateDocs(validationRoot, { silent: false });

  console.log('\n=== Summary ===');
  console.log(`  ${result.passCount} checks passed`);
  if (result.warnings.length > 0) console.log(`  ${result.warnings.length} warnings`);
  if (result.errors.length > 0) console.log(`  ${result.errors.length} errors`);

  process.exitCode = result.errors.length > 0 ? 1 : 0;
} finally {
  rmSync(tempParent, { recursive: true, force: true });
}
