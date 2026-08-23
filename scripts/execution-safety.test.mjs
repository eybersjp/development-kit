import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import {
  BLAST_RADIUS,
  DECISIONS,
  classifyCommand,
  createExecutionEnvironment,
  evaluateCommandSafety,
  fingerprintCommand,
} from '../runtime/orchestration/execution-safety.mjs';

function contract(overrides = {}) {
  return {
    executionSafety: {
      resourceScope: 'project-only',
      destructiveOperations: 'explicit-approval',
      remoteMutation: 'explicit-contract',
      ...overrides,
    },
  };
}

function localEnvironment(overrides = {}) {
  return createExecutionEnvironment({
    mode: 'local-isolated',
    projectRoot: path.join(os.tmpdir(), 'dk-safety-project'),
    declaredResources: {
      dockerContainers: ['proposal-db', 'proposal-api'],
      dockerProjects: ['proposal-builder'],
      supabaseProjectRefs: ['proposal-builder-local'],
      filesystemPaths: ['.next', 'dist'],
    },
    ...overrides,
  });
}

function exactApproval(command, overrides = {}) {
  return {
    commandFingerprint: fingerprintCommand(command),
    destructiveOperations: false,
    remoteMutation: false,
    allowedBlastRadii: [],
    ...overrides,
  };
}

test('REL-001 allows ordinary non-destructive local verification commands', () => {
  const result = evaluateCommandSafety({
    command: 'npm test',
    contract: contract(),
    environment: localEnvironment(),
  });
  assert.equal(result.decision, DECISIONS.ALLOW);
  assert.equal(result.destructive, false);
  assert.equal(result.remoteMutation, false);
  assert.equal(result.blastRadius, BLAST_RADIUS.NONE);
});

test('REL-001 blocks the Proposal Builder host-wide Docker removal incident by default', () => {
  const command = 'docker rm -f $(docker ps -aq)';
  const result = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });

  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.destructive, true);
  assert.equal(result.blastRadius, BLAST_RADIUS.HOST_WIDE);
  assert.equal(result.projectOwnershipProvable, false);
  assert.match(result.blockers.join('\n'), /exceeds project-only resource scope/);
});

test('REL-001 requires exact higher approval before host-wide blast radius can be authorized', () => {
  const command = 'docker system prune -af';
  const withoutApproval = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
  assert.equal(withoutApproval.decision, DECISIONS.BLOCK);

  const wrongCommandApproval = exactApproval('docker ps', {
    destructiveOperations: true,
    allowedBlastRadii: [BLAST_RADIUS.HOST_WIDE],
  });
  assert.equal(
    evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment(), approval: wrongCommandApproval }).decision,
    DECISIONS.BLOCK,
  );

  const exactHigherApproval = exactApproval(command, {
    destructiveOperations: true,
    allowedBlastRadii: [BLAST_RADIUS.HOST_WIDE],
  });
  assert.equal(
    evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment(), approval: exactHigherApproval }).decision,
    DECISIONS.ALLOW,
  );
});

test('REL-001 allows only explicitly approved deletion of declared Docker resources', () => {
  const command = 'docker rm -f proposal-db proposal-api';
  const pending = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
  assert.equal(pending.decision, DECISIONS.REQUIRE_APPROVAL);
  assert.equal(pending.blastRadius, BLAST_RADIUS.DECLARED_RESOURCE);
  assert.equal(pending.projectOwnershipProvable, true);

  const approved = evaluateCommandSafety({
    command,
    contract: contract(),
    environment: localEnvironment(),
    approval: exactApproval(command, { destructiveOperations: true }),
  });
  assert.equal(approved.decision, DECISIONS.ALLOW);
});

test('REL-001 blocks deletion of undeclared Docker resources in a project-only contract', () => {
  const command = 'docker rm -f unrelated-container';
  const result = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
  assert.equal(result.decision, DECISIONS.BLOCK);
  assert.equal(result.projectOwnershipProvable, false);
  assert.equal(result.blastRadius, BLAST_RADIUS.UNKNOWN);
});

test('REL-001 never downgrades host-wide risk when destructive commands are chained', () => {
  const command = 'docker system prune -af && rm -rf .next';
  const result = classifyCommand(command, localEnvironment());
  assert.equal(result.destructive, true);
  assert.equal(result.blastRadius, BLAST_RADIUS.HOST_WIDE);
  assert.equal(result.projectOwnershipProvable, false);
});

test('REL-001 requires destructive approval for local Supabase reset', () => {
  const command = 'npx supabase db reset';
  const pending = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
  assert.equal(pending.decision, DECISIONS.REQUIRE_APPROVAL);
  assert.equal(pending.destructive, true);
  assert.equal(pending.remoteMutation, false);
  assert.equal(pending.blastRadius, BLAST_RADIUS.PROJECT);

  const approved = evaluateCommandSafety({
    command,
    contract: contract(),
    environment: localEnvironment(),
    approval: exactApproval(command, { destructiveOperations: true }),
  });
  assert.equal(approved.decision, DECISIONS.ALLOW);
});

test('REL-001 requires both destructive and remote authorization for remote database reset', () => {
  const command = 'npx supabase db reset';
  const environment = localEnvironment({
    mode: 'staging',
    linkedRemote: true,
    declaredResources: { supabaseProjectRefs: ['staging-project'] },
  });

  const pending = evaluateCommandSafety({ command, contract: contract(), environment });
  assert.equal(pending.decision, DECISIONS.REQUIRE_APPROVAL);
  assert.equal(pending.remoteMutation, true);
  assert.equal(pending.blastRadius, BLAST_RADIUS.REMOTE_PROJECT);

  const destructiveOnly = exactApproval(command, { destructiveOperations: true });
  assert.equal(evaluateCommandSafety({ command, contract: contract(), environment, approval: destructiveOnly }).decision, DECISIONS.REQUIRE_APPROVAL);

  const fullyApproved = exactApproval(command, { destructiveOperations: true, remoteMutation: true });
  assert.equal(evaluateCommandSafety({ command, contract: contract(), environment, approval: fullyApproved }).decision, DECISIONS.ALLOW);
});

test('REL-001 does not classify a read-only local command as remote merely because environment metadata is production', () => {
  const environment = localEnvironment({ mode: 'production', linkedRemote: true });
  const result = classifyCommand('npm test', environment);
  assert.equal(result.remoteMutation, false);
  assert.equal(result.blastRadius, BLAST_RADIUS.NONE);
});

test('REL-001 requires remote approval for publication and push commands', () => {
  for (const command of ['npm publish', 'git push origin main']) {
    const pending = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
    assert.equal(pending.decision, DECISIONS.REQUIRE_APPROVAL, command);
    assert.equal(pending.remoteMutation, true, command);

    const approved = evaluateCommandSafety({
      command,
      contract: contract(),
      environment: localEnvironment(),
      approval: exactApproval(command, { remoteMutation: true }),
    });
    assert.equal(approved.decision, DECISIONS.ALLOW, command);
  }
});

test('REL-001 blocks remote mutation when contract forbids it even with approval', () => {
  const command = 'npm publish';
  const result = evaluateCommandSafety({
    command,
    contract: contract({ remoteMutation: 'forbidden' }),
    environment: localEnvironment(),
    approval: exactApproval(command, { remoteMutation: true }),
  });
  assert.equal(result.decision, DECISIONS.BLOCK);
});

test('REL-001 treats destructive Git commands as project-scope operations requiring approval', () => {
  for (const command of ['git reset --hard HEAD~1', 'git clean -fdx']) {
    const result = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
    assert.equal(result.decision, DECISIONS.REQUIRE_APPROVAL, command);
    assert.equal(result.destructive, true, command);
    assert.equal(result.blastRadius, BLAST_RADIUS.PROJECT, command);
  }
});

test('REL-001 blocks recursive deletion outside the project across POSIX and Windows path forms', () => {
  for (const command of ['rm -rf /tmp/unrelated-project', 'Remove-Item -Recurse -Force C:\\Users\\OtherProject']) {
    const result = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
    assert.equal(result.decision, DECISIONS.BLOCK, command);
    assert.equal(result.projectOwnershipProvable, false, command);
    assert.equal(result.blastRadius, BLAST_RADIUS.EXTERNAL_FILESYSTEM, command);
  }
});

test('REL-001 keeps project-local recursive cleanup behind explicit destructive approval', () => {
  const command = 'rm -rf .next';
  const pending = evaluateCommandSafety({ command, contract: contract(), environment: localEnvironment() });
  assert.equal(pending.decision, DECISIONS.REQUIRE_APPROVAL);
  assert.equal(pending.blastRadius, BLAST_RADIUS.PROJECT);

  const approved = evaluateCommandSafety({
    command,
    contract: contract(),
    environment: localEnvironment(),
    approval: exactApproval(command, { destructiveOperations: true }),
  });
  assert.equal(approved.decision, DECISIONS.ALLOW);
});

test('REL-001 contract-level destructive prohibition cannot be overridden at runtime', () => {
  const command = 'git reset --hard HEAD';
  const result = evaluateCommandSafety({
    command,
    contract: contract({ destructiveOperations: 'forbidden' }),
    environment: localEnvironment(),
    approval: exactApproval(command, { destructiveOperations: true }),
  });
  assert.equal(result.decision, DECISIONS.BLOCK);
});
