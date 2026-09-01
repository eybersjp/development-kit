import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import {
  CommandSafetyError,
  evaluateCommandSafety,
} from '../runtime/orchestration/execution-safety.mjs';

const environment = {
  mode: 'local-isolated',
  projectRoot: path.join(os.tmpdir(), 'dk-policy-test'),
};

function validPolicy() {
  return {
    resourceScope: 'project-only',
    destructiveOperations: 'explicit-approval',
    remoteMutation: 'explicit-contract',
  };
}

test('REL-001 rejects missing execution safety policy', () => {
  assert.throws(
    () => evaluateCommandSafety({ command: 'npm test', contract: {}, environment }),
    CommandSafetyError,
  );
});

test('REL-001 rejects unknown resource scope instead of treating it as permissive', () => {
  const executionSafety = { ...validPolicy(), resourceScope: 'everything' };
  assert.throws(
    () => evaluateCommandSafety({ command: 'docker system prune -af', contract: { executionSafety }, environment }),
    /Invalid executionSafety\.resourceScope/,
  );
});

test('REL-001 rejects unknown destructive-operation policy instead of accepting runtime approval', () => {
  const executionSafety = { ...validPolicy(), destructiveOperations: 'unrestricted' };
  assert.throws(
    () => evaluateCommandSafety({ command: 'git reset --hard HEAD', contract: { executionSafety }, environment }),
    /Invalid executionSafety\.destructiveOperations/,
  );
});

test('REL-001 rejects unknown remote-mutation policy instead of silently allowing publication', () => {
  const executionSafety = { ...validPolicy(), remoteMutation: 'unrestricted' };
  assert.throws(
    () => evaluateCommandSafety({ command: 'npm publish', contract: { executionSafety }, environment }),
    /Invalid executionSafety\.remoteMutation/,
  );
});
