import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  NextStepResolver,
  resolveNextStep,
  formatNextStepGuidance,
  appendNextStepGuidance,
  CommandRegistry,
  defaultCommandRegistry,
  isValidCommand,
  getCommandMetadata
} from '../runtime/next-step/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, 'next-step.mjs');

// ---------------------------------------------------------------------------
// 1. Direct appendNextStepGuidance() Unit Tests
// ---------------------------------------------------------------------------

test('appendNextStepGuidance: one recommendation appends singular header and recommendation', () => {
  const content = 'Implementation complete.';
  const context = { completedCommand: '/dk-build', lifecycleStage: 'IMPLEMENT', success: true };
  const result = appendNextStepGuidance(content, context);

  assert.ok(result.startsWith(content));
  assert.ok(result.includes('## Suggested Next Step'));
  assert.ok(!result.includes('## Suggested Next Steps'));
  assert.ok(result.includes('1. `/dk-test`'));
});

test('appendNextStepGuidance: multiple recommendations appends plural header with Recommended prefix', () => {
  const content = 'Planning finished.';
  const context = { completedCommand: '/dk-tasks', lifecycleStage: 'PLAN', success: true };
  const result = appendNextStepGuidance(content, context, { maxRecommendations: 2 });

  assert.ok(result.startsWith(content));
  assert.ok(result.includes('## Suggested Next Steps'));
  assert.ok(result.includes('1. `/dk-build`'));
  assert.ok(result.includes('2. `/dk-build-auto`'));
  assert.ok(result.includes('Recommended.'));
});

test('appendNextStepGuidance: no recommendations leaves content completely unchanged', () => {
  const content = 'Workflow is finished.';
  const context = { isWorkflowComplete: true };
  const result = appendNextStepGuidance(content, context);

  assert.equal(result, content);
});

test('appendNextStepGuidance: handles content ending with and without a newline cleanly', () => {
  const context = { completedCommand: '/dk-idea', lifecycleStage: 'UNDERSTAND', success: true };

  const withoutNewline = 'Done';
  const res1 = appendNextStepGuidance(withoutNewline, context);
  assert.ok(res1.startsWith('Done\n\n## Suggested Next Step'));

  const withNewline = 'Done\n';
  const res2 = appendNextStepGuidance(withNewline, context);
  assert.ok(res2.startsWith('Done\n\n## Suggested Next Step'));

  const withMultipleNewlines = 'Done\n\n\n';
  const res3 = appendNextStepGuidance(withMultipleNewlines, context);
  assert.ok(res3.startsWith('Done\n\n## Suggested Next Step'));
});

test('appendNextStepGuidance: automated mode suppresses guidance', () => {
  const content = 'Batch executing.';
  const context = { completedCommand: '/dk-build', lifecycleStage: 'IMPLEMENT', success: true, isAutomated: true };
  const result = appendNextStepGuidance(content, context);

  assert.equal(result, content);
});

test('appendNextStepGuidance: terminal workflow suppresses guidance', () => {
  const content = 'Release complete.';
  const context = { completedCommand: '/dk-ship', lifecycleStage: 'COMPLETE', success: true, isWorkflowComplete: true };
  const result = appendNextStepGuidance(content, context);

  assert.equal(result, content);
});

// ---------------------------------------------------------------------------
// 2. Strict Consequential Safety & Gate Tests (/dk-ship)
// ---------------------------------------------------------------------------

const BASE_SHIPPING_CONTEXT = Object.freeze({
  lifecycleStage: 'COMPLETE',
  success: true,
  approvalStatus: 'approved',
  verificationStatus: 'passed',
  testsStatus: 'passed',
  reviewStatus: 'passed',
  postSimplificationVerificationStatus: 'passed',
  outstandingApprovals: [],
  blockers: [],
  isAutomated: false
});

test('Safety Positive: /dk-ship is recommended ONLY when all 9 conditions are explicitly satisfied', () => {
  const result = resolveNextStep(BASE_SHIPPING_CONTEXT);
  assert.ok(result.length > 0);
  assert.equal(result[0].command, '/dk-ship');
  assert.equal(result[0].priority, 'primary');
});

test('Safety Fail-Closed: reviewStatus must be strictly "passed" to allow /dk-ship', () => {
  const invalidReviewStatuses = [
    undefined,
    null,
    '',
    'pending',
    'failed',
    'rejected',
    'skipped',
    'unknown_value',
    'PASS',
    true,
    1
  ];

  for (const status of invalidReviewStatuses) {
    const ctx = {
      ...BASE_SHIPPING_CONTEXT,
      reviewStatus: status
    };
    const recs = resolveNextStep(ctx);
    const commands = recs.map(r => r.command);
    assert.ok(
      !commands.includes('/dk-ship'),
      `reviewStatus="${status}" must strictly block /dk-ship recommendation`
    );
  }
});

test('Safety Fail-Closed: postSimplificationVerificationStatus must be strictly "passed" to allow /dk-ship', () => {
  const invalidPostSimpStatuses = [
    undefined,
    null,
    '',
    'unverified',
    'pending',
    'failed',
    'unknown',
    'skipped',
    false
  ];

  for (const status of invalidPostSimpStatuses) {
    const ctx = {
      ...BASE_SHIPPING_CONTEXT,
      postSimplificationVerificationStatus: status
    };
    const recs = resolveNextStep(ctx);
    const commands = recs.map(r => r.command);
    assert.ok(
      !commands.includes('/dk-ship'),
      `postSimplificationVerificationStatus="${status}" must strictly block /dk-ship`
    );
  }
});

test('Safety Gate: After /dk-simplify, ONLY /dk-test is recommended (never /dk-ship)', () => {
  const simplifyResult = resolveNextStep({
    completedCommand: '/dk-simplify',
    lifecycleStage: 'SIMPLIFY',
    success: true
  });

  assert.ok(simplifyResult.length > 0);
  assert.equal(simplifyResult[0].command, '/dk-test');
  const commands = simplifyResult.map(r => r.command);
  assert.ok(!commands.includes('/dk-ship'), '/dk-ship must NEVER be recommended immediately after /dk-simplify');
});

// ---------------------------------------------------------------------------
// 3. One-Condition-at-a-Time Negative Safety Test Table
// ---------------------------------------------------------------------------

const ONE_CONDITION_NEGATIVE_SCENARIOS = [
  {
    name: 'success is false',
    mutation: { success: false },
    reason: 'Failed operation cannot ship'
  },
  {
    name: 'approvalStatus is missing/undefined',
    mutation: { approvalStatus: undefined },
    reason: 'Absence of approval evidence is not approval'
  },
  {
    name: 'approvalStatus is pending',
    mutation: { approvalStatus: 'pending' },
    reason: 'Pending human approval blocks consequential ship'
  },
  {
    name: 'approvalStatus is rejected',
    mutation: { approvalStatus: 'rejected' },
    reason: 'Rejected approval blocks ship'
  },
  {
    name: 'approvalStatus is not_required',
    mutation: { approvalStatus: 'not_required' },
    reason: 'Consequential ship strictly requires explicit human approval'
  },
  {
    name: 'verificationStatus is unverified',
    mutation: { verificationStatus: 'unverified' },
    reason: 'Unverified state cannot ship'
  },
  {
    name: 'verificationStatus is failed',
    mutation: { verificationStatus: 'failed' },
    reason: 'Failed verification cannot ship'
  },
  {
    name: 'testsStatus is failed',
    mutation: { testsStatus: 'failed' },
    reason: 'Broken tests cannot ship'
  },
  {
    name: 'testsStatus is undefined',
    mutation: { testsStatus: undefined },
    reason: 'Missing tests status cannot ship'
  },
  {
    name: 'reviewStatus is undefined',
    mutation: { reviewStatus: undefined },
    reason: 'Missing review status cannot ship'
  },
  {
    name: 'reviewStatus is failed',
    mutation: { reviewStatus: 'failed' },
    reason: 'Failed review cannot ship'
  },
  {
    name: 'postSimplificationVerificationStatus is missing/undefined',
    mutation: { postSimplificationVerificationStatus: undefined },
    reason: 'Missing post-simplification verification cannot ship'
  },
  {
    name: 'postSimplificationVerificationStatus is unverified',
    mutation: { postSimplificationVerificationStatus: 'unverified' },
    reason: 'Unverified post-simplification regression cannot ship'
  },
  {
    name: 'postSimplificationVerificationStatus is failed',
    mutation: { postSimplificationVerificationStatus: 'failed' },
    reason: 'Failed post-simplification regression cannot ship'
  },
  {
    name: 'active blockers exist',
    mutation: { blockers: ['unresolved_security_vulnerability'] },
    reason: 'Active blockers block all forward shipping'
  },
  {
    name: 'outstanding approvals exist',
    mutation: { outstandingApprovals: ['pending_gate_token'] },
    reason: 'Outstanding approval tokens block ship'
  },
  {
    name: 'isAutomated is true',
    mutation: { isAutomated: true },
    reason: 'Automated mode cannot bypass human ship gate'
  }
];

test('Table-Driven One-Condition-at-a-Time Negative Safety Table: /dk-ship strictly blocked', () => {
  for (const scenario of ONE_CONDITION_NEGATIVE_SCENARIOS) {
    const mutatedContext = {
      ...BASE_SHIPPING_CONTEXT,
      ...scenario.mutation
    };

    const recommendations = resolveNextStep(mutatedContext);
    const commands = recommendations.map(r => r.command);

    assert.ok(
      !commands.includes('/dk-ship'),
      `Scenario "${scenario.name}" (${scenario.reason}) must NOT recommend /dk-ship`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Comprehensive Table-Driven Policy Test for ALL 14 Public Commands
// ---------------------------------------------------------------------------

const POLICY_SCENARIOS = [
  // 1. /dk-autopilot
  {
    completedCommand: '/dk-autopilot',
    context: { isAutomated: true, isPaused: false },
    expectedPrimary: null,
    forbidden: ['/dk-spec', '/dk-build', '/dk-ship'],
    reason: 'Active automation suppresses intermediate guidance'
  },
  {
    completedCommand: '/dk-autopilot',
    context: { isPaused: true },
    expectedPrimary: '/dk-status',
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Paused autopilot workflow recommends state inspection'
  },
  {
    completedCommand: '/dk-autopilot',
    context: { success: false },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-spec', '/dk-ship'],
    reason: 'Failed autopilot run recommends debugging'
  },

  // 2. /dk-idea
  {
    completedCommand: '/dk-idea',
    context: { success: true },
    expectedPrimary: '/dk-idea',
    forbidden: ['/dk-build', '/dk-ship'],
    reason: 'Idea discovery without approved state continues discovery/approval'
  },
  {
    completedCommand: '/dk-idea',
    context: { blockers: ['ambiguous_core_scope'] },
    expectedPrimary: '/dk-idea',
    forbidden: ['/dk-build', '/dk-ship'],
    reason: 'Product blocker on idea stage routes to /dk-idea'
  },

  // 3. /dk-research
  {
    completedCommand: '/dk-research',
    context: { success: true },
    expectedPrimary: '/dk-spec',
    forbidden: ['/dk-ship', '/dk-build'],
    reason: 'Research completed -> synthesize into specification'
  },

  // 4. /dk-spec
  {
    completedCommand: '/dk-spec',
    context: { success: true },
    expectedPrimary: '/dk-design',
    forbidden: ['/dk-ship', '/dk-build'],
    reason: 'Specification approved -> technical and visual design'
  },

  // 5. /dk-design
  {
    completedCommand: '/dk-design',
    context: { success: true },
    expectedPrimary: '/dk-tasks',
    forbidden: ['/dk-ship', '/dk-build'],
    reason: 'Design approved -> task decomposition'
  },

  // 6. /dk-tasks
  {
    completedCommand: '/dk-tasks',
    context: { success: true },
    expectedPrimary: '/dk-build',
    forbidden: ['/dk-ship', '/dk-review'],
    reason: 'Tasks planned -> start implementation loop'
  },

  // 7. /dk-build
  {
    completedCommand: '/dk-build',
    context: { success: true, verificationStatus: 'unverified' },
    expectedPrimary: '/dk-test',
    forbidden: ['/dk-ship', '/dk-review'],
    reason: 'Task implemented unverified -> verify before proceeding'
  },
  {
    completedCommand: '/dk-build',
    context: { success: true, verificationStatus: 'passed', remainingTasks: 2 },
    expectedPrimary: '/dk-build',
    forbidden: ['/dk-ship', '/dk-review'],
    reason: 'Task verified with remaining tasks -> continue next task'
  },
  {
    completedCommand: '/dk-build',
    context: { success: false },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-review', '/dk-ship'],
    reason: 'Implementation failure -> debug root cause'
  },

  // 8. /dk-build-auto
  {
    completedCommand: '/dk-build-auto',
    context: { isAutomated: true },
    expectedPrimary: null,
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Automated batch running -> suppress guidance'
  },
  {
    completedCommand: '/dk-build-auto',
    context: { success: true, isAutomated: false },
    expectedPrimary: '/dk-test',
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Batch build completed -> full plan verification'
  },
  {
    completedCommand: '/dk-build-auto',
    context: { success: false, isAutomated: false },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-review', '/dk-ship'],
    reason: 'Batch build failed -> debug failure'
  },

  // 9. /dk-test
  {
    completedCommand: '/dk-test',
    context: { success: true, verificationStatus: 'passed', testsStatus: 'passed' },
    expectedPrimary: '/dk-review',
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Tests passed -> two-stage review'
  },
  {
    completedCommand: '/dk-test',
    context: { success: false, verificationStatus: 'failed', testsStatus: 'failed' },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-review', '/dk-ship', '/dk-spec'],
    reason: 'Tests failed -> debug root cause'
  },

  // 10. /dk-review
  {
    completedCommand: '/dk-review',
    context: { success: true, reviewStatus: 'passed' },
    expectedPrimary: '/dk-simplify',
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Review approved -> Ponytail simplicity ladder'
  },
  {
    completedCommand: '/dk-review',
    context: { success: false, reviewStatus: 'failed' },
    expectedPrimary: '/dk-build',
    forbidden: ['/dk-ship', '/dk-simplify'],
    reason: 'Review findings require implementation fixes'
  },

  // 11. /dk-simplify
  {
    completedCommand: '/dk-simplify',
    context: { success: true },
    expectedPrimary: '/dk-test',
    forbidden: ['/dk-ship', '/dk-spec'],
    reason: 'Simplification complete -> regression test before shipping'
  },

  // 12. /dk-debug
  {
    completedCommand: '/dk-debug',
    context: { success: true, previousCommand: '/dk-test' },
    expectedPrimary: '/dk-test',
    forbidden: ['/dk-spec', '/dk-ship'],
    reason: 'Debug fix applied -> re-run failed test command'
  },
  {
    completedCommand: '/dk-debug',
    context: { success: true },
    expectedPrimary: '/dk-test',
    forbidden: ['/dk-spec', '/dk-ship'],
    reason: 'Debug fix applied without previousCommand context -> verify with /dk-test (never /dk-spec)'
  },

  // 13. /dk-ship
  {
    completedCommand: '/dk-ship',
    context: { success: true, isWorkflowComplete: true },
    expectedPrimary: null,
    forbidden: ['/dk-spec', '/dk-build'],
    reason: 'Shipping complete -> terminal state (empty)'
  },
  {
    completedCommand: '/dk-ship',
    context: { success: false },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-spec'],
    reason: 'Pre-ship failure -> diagnose failure'
  },

  // 14. /dk-status
  {
    completedCommand: '/dk-status',
    context: { lifecycleStage: 'PLAN' },
    expectedPrimary: '/dk-build',
    forbidden: ['/dk-ship'],
    reason: 'Status in PLAN stage -> recommend build'
  },
  {
    completedCommand: '/dk-status',
    context: { lifecycleStage: 'VERIFY', verificationStatus: 'failed' },
    expectedPrimary: '/dk-debug',
    forbidden: ['/dk-review', '/dk-ship'],
    reason: 'Status with verification failures -> recommend debug'
  },

  // Unknown command fallback
  {
    completedCommand: '/dk-nonexistent-command',
    context: {},
    expectedPrimary: '/dk-status',
    forbidden: ['/dk-spec', '/dk-ship', '/dk-build'],
    reason: 'Unknown command -> safe status inspection (never silent stage transition)'
  }
];

test('Table-Driven Comprehensive Policy Test: asserts all 14 commands and safety constraints', () => {
  for (const scenario of POLICY_SCENARIOS) {
    const rawContext = {
      completedCommand: scenario.completedCommand,
      ...scenario.context
    };

    const recommendations = resolveNextStep(rawContext);

    if (scenario.expectedPrimary === null) {
      assert.equal(
        recommendations.length,
        0,
        `Scenario ${scenario.completedCommand} (${scenario.reason}) should return no recommendations`
      );
    } else {
      assert.ok(
        recommendations.length > 0,
        `Scenario ${scenario.completedCommand} (${scenario.reason}) must return recommendations`
      );
      assert.equal(
        recommendations[0].command,
        scenario.expectedPrimary,
        `Scenario ${scenario.completedCommand} (${scenario.reason}): expected primary ${scenario.expectedPrimary}, got ${recommendations[0].command}`
      );
    }

    const recommendedCommands = recommendations.map(r => r.command);
    for (const forbidden of scenario.forbidden) {
      assert.ok(
        !recommendedCommands.includes(forbidden),
        `Scenario ${scenario.completedCommand} (${scenario.reason}) must NOT recommend forbidden command ${forbidden}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Direct CLI Flag Validation Tests
// ---------------------------------------------------------------------------

test('CLI: Valid flags run cleanly and output Markdown guidance', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--stage=IMPLEMENT', '--success=true'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /## Suggested Next Step/);
  assert.match(res.stdout, /\/dk-test/);
});

test('CLI: Invalid --approval rejects unknown status and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--approval=invalid_app'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid approval status: invalid_app'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid --verification rejects unknown status and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--verification=bad_ver'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid verification status: bad_ver'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid --tests rejects unknown status and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--tests=broken'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid tests status: broken'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid --review rejects unknown status and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--review=rejected'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid review status: rejected'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid --post-simplification rejects unknown status and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--post-simplification=maybe'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid post-simplification status: maybe'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid Boolean --success rejects arbitrary string and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--success=yes'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid --success value: "yes"'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('CLI: Invalid Boolean --complete rejects non-boolean string and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--complete=1'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid --complete value: "1"'));
});

test('CLI: Invalid Boolean --automated rejects non-boolean string and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--automated=trueish'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid --automated value: "trueish"'));
});

test('CLI: Invalid Boolean --paused rejects non-boolean string and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--paused=on'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid --paused value: "on"'));
});

test('CLI: Invalid --previous-command rejects unknown command and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-debug', '--previous-command=/dk-invalid-cmd'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Unknown previous-command: /dk-invalid-cmd'));
});

test('CLI: Invalid --stage rejects unknown stage and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--stage=NON_EXISTENT_STAGE'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid lifecycle stage: NON_EXISTENT_STAGE'));
});

test('CLI: Invalid --command rejects unknown command and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-unknown-command'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Unknown command: /dk-unknown-command'));
});

test('CLI: Invalid numeric --max rejects zero, negative, and float and exits with code 1', () => {
  const zeroRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--max=0'], { encoding: 'utf8' });
  assert.equal(zeroRes.status, 1);
  assert.ok(zeroRes.stderr.includes('Invalid --max value'));

  const negRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--max=-1'], { encoding: 'utf8' });
  assert.equal(negRes.status, 1);
  assert.ok(negRes.stderr.includes('Invalid --max value'));

  const floatRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--max=2.5'], { encoding: 'utf8' });
  assert.equal(floatRes.status, 1);
  assert.ok(floatRes.stderr.includes('Invalid --max value'));
});

test('CLI: Invalid numeric --remaining-tasks rejects negative, string, and float and exits with code 1', () => {
  const negRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--remaining-tasks=-2'], { encoding: 'utf8' });
  assert.equal(negRes.status, 1);
  assert.ok(negRes.stderr.includes('Invalid --remaining-tasks value'));

  const strRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--remaining-tasks=two'], { encoding: 'utf8' });
  assert.equal(strRes.status, 1);
  assert.ok(strRes.stderr.includes('Invalid --remaining-tasks value'));

  const floatRes = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--remaining-tasks=1.5'], { encoding: 'utf8' });
  assert.equal(floatRes.status, 1);
  assert.ok(floatRes.stderr.includes('Invalid --remaining-tasks value'));
});

test('CLI: Invalid --format rejects invalid format and exits with code 1', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-build', '--format=yaml'], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid output format: yaml'));
});

test('CLI: Valid JSON output produces parseable JSON array', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--command=/dk-idea', '--format=json'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed.recommendations));
  assert.equal(parsed.recommendations[0].command, '/dk-idea');
  assert.equal(parsed.count, parsed.recommendations.length);
});

// ---------------------------------------------------------------------------
// 6. Context JSON & Context File Schema Validation Tests
// ---------------------------------------------------------------------------

test('Context JSON: Syntactically valid JSON with unknown command fails schema validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"completedCommand":"/dk-nonexistent"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Error in context JSON: Unknown command: /dk-nonexistent'));
  assert.ok(!res.stdout.includes('## Suggested Next Step'));
});

test('Context JSON: Syntactically valid JSON with invalid lifecycleStage fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"lifecycleStage":"BUILD_PHASE"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid lifecycle stage: BUILD_PHASE'));
});

test('Context JSON: Invalid verificationStatus fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"verificationStatus":"corrupt"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid verification status: corrupt'));
});

test('Context JSON: Invalid testsStatus fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"testsStatus":"error"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid tests status: error'));
});

test('Context JSON: Invalid reviewStatus fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"reviewStatus":"declined"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid review status: declined'));
});

test('Context JSON: Invalid approvalStatus fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"approvalStatus":"granted"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid approval status: granted'));
});

test('Context JSON: Invalid postSimplificationVerificationStatus fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"postSimplificationVerificationStatus":"unknown"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid post-simplification verification status: unknown'));
});

test('Context JSON: Non-boolean success field fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"success":"true"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid success value: true (must be boolean)'));
});

test('Context JSON: Negative or non-integer remainingTasks fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"remainingTasks":-5}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid remainingTasks value'));
});

test('Context JSON: Malformed blockers field (non-array) fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"blockers":"single_blocker"}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid blockers value: must be an array of strings'));
});

test('Context JSON: Malformed outstandingApprovals field fails validation', () => {
  const res = spawnSync(process.execPath, [CLI_PATH, '--context-json={"outstandingApprovals":[123]}'], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('Invalid outstandingApprovals value: must be an array of strings'));
});

test('Context File: Valid complete context file resolves cleanly', () => {
  const tempFile = path.join(tmpdir(), `valid-context-${Date.now()}.json`);
  writeFileSync(tempFile, JSON.stringify({
    completedCommand: '/dk-spec',
    lifecycleStage: 'DEFINE',
    success: true
  }), 'utf8');

  try {
    const res = spawnSync(process.execPath, [CLI_PATH, `--context-file=${tempFile}`], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /## Suggested Next Step/);
    assert.match(res.stdout, /\/dk-design/);
  } finally {
    try { unlinkSync(tempFile); } catch {}
  }
});

test('Context File: Malformed JSON syntax in context file fails with error', () => {
  const tempFile = path.join(tmpdir(), `bad-syntax-${Date.now()}.json`);
  writeFileSync(tempFile, '{ unquoted_bad_json: 123 }', 'utf8');

  try {
    const res = spawnSync(process.execPath, [CLI_PATH, `--context-file=${tempFile}`], {
      encoding: 'utf8'
    });
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('Error parsing context file'));
    assert.ok(!res.stdout.includes('## Suggested Next Step'));
  } finally {
    try { unlinkSync(tempFile); } catch {}
  }
});
