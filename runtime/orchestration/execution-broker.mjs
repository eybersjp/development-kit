import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  BLAST_RADIUS,
  DECISIONS,
  createExecutionEnvironment,
  evaluateCommandSafety,
  fingerprintCommand,
} from './execution-safety.mjs';
import { validateDevelopmentContract } from './development-contract.mjs';
import { getRunDirectory } from './evidence-store.mjs';

export const OPERATION_CLASSES = Object.freeze([
  'shell',
  'filesystem-mutation',
  'git-mutation',
  'docker',
  'database-mutation',
  'supabase-mutation',
  'package-publication',
  'deployment',
  'remote-mutation',
  'infrastructure-mutation',
  'recursive-deletion',
  'external-filesystem-mutation',
  'host-wide-cleanup',
  'read-only',
]);

export class ExecutionBrokerError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ExecutionBrokerError';
    this.details = details;
  }
}

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function string(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new ExecutionBrokerError(`${label} must be a non-empty string`);
  return value.trim();
}

function classifyOperation(command, environment = {}) {
  const normalized = typeof command === 'string' ? command.trim() : '';
  const tokens = normalized.split(/\s+/);
  const head = tokens[0]?.toLowerCase() ?? '';

  if (/\b(docker\s+system\s+prune|docker\s+rm\s+-f\s+\$\(docker\s+ps)\b/i.test(normalized)) {
    return 'host-wide-cleanup';
  }
  if (/^rm\s+-[a-z]*r[a-z]*\s+(\/|[A-Za-z]:\\)/i.test(normalized)
    || /^Remove-Item\s+.*-Recurse\s+.*([A-Za-z]:\\|\/)/i.test(normalized)) {
    return 'external-filesystem-mutation';
  }
  if (/\b(rm\s+-[a-z]*r|Remove-Item\s+.*-Recurse)\b/i.test(normalized)) {
    return 'recursive-deletion';
  }
  if (head === 'docker') return 'docker';
  if (head === 'git' && tokens.some((t) => ['reset', 'clean', 'push', 'commit', 'checkout', 'branch', 'tag', 'merge', 'rebase'].includes(t.toLowerCase()))) {
    return 'git-mutation';
  }
  if (/\b(supabase\s+db|supabase\s+migration|prisma\s+migrate|dbt\s+run)\b/i.test(normalized)) {
    return 'database-mutation';
  }
  if (/\b(npm\s+publish|yarn\s+publish|pnpm\s+publish)\b/i.test(normalized)) {
    return 'package-publication';
  }
  if (/\b(vercel|flyctl|wrangler\s+deploy|terraform\s+apply|pulumi\s+up|aws\s+s3|gcloud\s+app\s+deploy)\b/i.test(normalized)) {
    return 'deployment';
  }
  if (head === 'git' && tokens.includes('push')) {
    return 'remote-mutation';
  }
  return 'shell';
}

export class ExecutionBroker {
  constructor({
    contract,
    runId = null,
    rootDir = process.cwd(),
    capabilities = {},
    environment = {},
    approvals = [],
  } = {}) {
    validateDevelopmentContract(contract);
    this.contract = contract;
    this.runId = runId ? string(runId, 'runId') : null;
    this.rootDir = path.resolve(rootDir);
    this.capabilities = { ...capabilities };
    this.environment = createExecutionEnvironment({
      projectRoot: this.rootDir,
      ...environment,
    });
    this.approvals = Array.isArray(approvals) ? [...approvals] : [];
    this.executionLog = [];
  }

  evaluate({ command, operationClass = null, approval = null } = {}) {
    const rawCommand = string(command, 'command');
    const matchedApproval = approval ?? this.findApproval(rawCommand);
    const assessment = evaluateCommandSafety({
      command: rawCommand,
      contract: this.contract,
      environment: this.environment,
      approval: matchedApproval,
    });

    const determinedClass = operationClass ?? classifyOperation(rawCommand, this.environment);

    let mediationSupported = true;
    let mediationLimitation = null;

    if (this.capabilities.guaranteedMediation === false) {
      mediationSupported = false;
      mediationLimitation = 'Host environment does not support guaranteed execution interception';
    }

    const result = {
      schemaVersion: '1.0.0',
      command: rawCommand,
      commandFingerprint: fingerprintCommand(rawCommand),
      contractId: this.contract.contractId,
      runId: this.runId,
      operationClass: determinedClass,
      blastRadius: assessment.blastRadius,
      destructive: assessment.destructive,
      remoteMutation: assessment.remoteMutation,
      projectOwnershipProvable: assessment.projectOwnershipProvable,
      decision: assessment.decision,
      blockers: assessment.blockers,
      approvalsNeeded: assessment.approvalsNeeded,
      mediationSupported,
      mediationLimitation,
      timestamp: new Date().toISOString(),
    };

    return Object.freeze(result);
  }

  findApproval(command) {
    const targetFingerprint = fingerprintCommand(command);
    return this.approvals.find((app) => app.commandFingerprint === targetFingerprint) ?? null;
  }

  registerApproval(approval) {
    if (!object(approval) || typeof approval.commandFingerprint !== 'string') {
      throw new ExecutionBrokerError('Invalid approval record');
    }
    this.approvals.push(structuredClone(approval));
  }

  execute({ command, spawnOptions = {}, approval = null, requireGuaranteedMediation = true } = {}) {
    const evaluation = this.evaluate({ command, approval });

    if (requireGuaranteedMediation && !evaluation.mediationSupported) {
      const err = new ExecutionBrokerError(
        `Execution blocked: ${evaluation.mediationLimitation}`,
        { evaluation, code: 'FAIL_CLOSED_UNSUPPORTED_MEDIATION' },
      );
      this.recordLog({ evaluation, executed: false, error: err.message });
      throw err;
    }

    if (evaluation.decision === DECISIONS.BLOCK) {
      const err = new ExecutionBrokerError(
        `Command execution blocked by safety policy: ${evaluation.blockers.join('; ')}`,
        { evaluation, blockers: evaluation.blockers },
      );
      this.recordLog({ evaluation, executed: false, error: err.message });
      throw err;
    }

    if (evaluation.decision === DECISIONS.REQUIRE_APPROVAL) {
      const err = new ExecutionBrokerError(
        `Command requires explicit approval: ${evaluation.approvalsNeeded.join('; ')}`,
        { evaluation, approvalsNeeded: evaluation.approvalsNeeded },
      );
      this.recordLog({ evaluation, executed: false, error: err.message });
      throw err;
    }

    const startTime = Date.now();
    const spawnArgs = process.platform === 'win32'
      ? ['cmd.exe', ['/d', '/s', '/c', command]]
      : ['/bin/sh', ['-c', command]];

    let spawnResult;
    try {
      spawnResult = spawnSync(spawnArgs[0], spawnArgs[1], {
        cwd: this.rootDir,
        encoding: 'utf8',
        ...spawnOptions,
      });
    } catch (spawnErr) {
      const logEntry = {
        evaluation,
        executed: false,
        error: spawnErr.message,
        timestamp: new Date().toISOString(),
      };
      this.recordLog(logEntry);
      throw spawnErr;
    }

    const durationMs = Date.now() - startTime;
    const logEntry = {
      evaluation,
      executed: true,
      exitCode: spawnResult.status ?? 1,
      stdout: spawnResult.stdout ?? '',
      stderr: spawnResult.stderr ?? '',
      durationMs,
      timestamp: new Date().toISOString(),
    };

    this.recordLog(logEntry);

    return {
      success: spawnResult.status === 0,
      exitCode: spawnResult.status ?? 1,
      stdout: spawnResult.stdout ?? '',
      stderr: spawnResult.stderr ?? '',
      evaluation,
      durationMs,
    };
  }

  recordLog(entry) {
    this.executionLog.push(entry);
    if (this.contract && this.runId) {
      try {
        const runDir = getRunDirectory(this.rootDir, this.contract.contractId, this.runId);
        if (fs.existsSync(runDir)) {
          const logPath = path.join(runDir, 'execution-broker-log.json');
          fs.writeFileSync(logPath, JSON.stringify(this.executionLog, null, 2), 'utf8');
        }
      } catch {
        // Logging write errors should not crash the broker
      }
    }
  }

  getExecutionLog() {
    return structuredClone(this.executionLog);
  }
}
