#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createRoleContext,
  decideAcceptance,
  decideCorrection,
  evaluateCommandSafety,
  evaluateRun,
  loadCurrentRunState,
  planCorrection,
  prepareTaskRun,
  validatePlanModel,
  verifyFromContext,
  validateIdeaBriefStructure,
  computeIdeaStageState,
  resolveCanonicalIdeaArtifact,
  persistCanonicalIdeaBrief,
  recordRequirementCandidate,
  recordOpenQuestion,
  evaluateDiscoveryReadiness,
  loadDiscoveryState,
  persistApprovalRecord,
  loadWorkflowCheckpoint,
  persistWorkflowCheckpoint,
  presentCurrentInteraction,
  resolveIdeaWorkflowState,
  recordDesignAuthoritySetup,
  recordIdeaChallengeResponse,
  consumeDiscoveryQuestionResponse,
  consumeRequirementConfirmation,
  consumeRequirementRejection,
  consumeRequirementModification,
  consumeQuestionSupersession,
  consumeScopeConfirmation,
  consumeBriefApproval,
} from '../runtime/orchestration/index.mjs';
import { reconcileCanonicalArtifact } from '../runtime/orchestration/reconciliation.mjs';
import { resolveProjectRoot } from '../runtime/bootstrap/project-root.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs() {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    options[key] = rest.length ? rest.join('=') : true;
  }
  return options;
}

function safeInputPath(rootDir, inputPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Input path escapes project root');
  return resolved;
}

function cleanJsonString(str) {
  if (typeof str !== 'string') return str;
  let s = str.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"') && s.startsWith('"{'))) {
    s = s.slice(1, -1);
  }
  return s;
}

function readPayload(options, rootDir) {
  if (typeof options['input-json'] === 'string') {
    const raw = cleanJsonString(options['input-json']);
    return JSON.parse(raw);
  }
  if (typeof options['input-file'] === 'string') {
    const resolved = safeInputPath(rootDir, options['input-file']);
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }
  return {};
}

function output(result) {
  process.stdout.write(`${JSON.stringify({ success: true, result }, null, 2)}\n`);
}

function fail(error) {
  process.stderr.write(`${JSON.stringify({ success: false, error: error.message, name: error.name, details: error.details ?? null, report: error.report ?? null }, null, 2)}\n`);
  process.exitCode = 1;
}

function main() {
  const options = parseArgs();
  const operation = options.operation;
  const explicitRoot = options['root-dir'] || options.rootDir;
  const rootDir = resolveProjectRoot({
    cwd: process.cwd(),
    executablePath: __filename,
    explicitRoot,
  });

  if (typeof operation !== 'string') throw new Error('Missing --operation');
  const payload = readPayload(options, rootDir);

  switch (operation) {
    case 'prepare-run': return output(prepareTaskRun({ ...payload, rootDir }));
    case 'context': return output(createRoleContext({ ...payload, rootDir }));
    case 'verify': return output(verifyFromContext(payload));
    case 'acceptance': return output(payload.run ? evaluateRun({ ...payload, rootDir }) : decideAcceptance({ ...payload, rootDir }));
    case 'correction': return output(payload.run ? planCorrection({ ...payload, rootDir }) : decideCorrection(payload));
    case 'safety': return output(evaluateCommandSafety(payload));
    case 'reconcile': return output(reconcileCanonicalArtifact({ ...payload, rootDir }));
    case 'plan-validate': return output(validatePlanModel(payload));
    case 'run-status': return output(loadCurrentRunState(payload.contractId, payload.runId, rootDir));
    case 'idea-validate': return output(validateIdeaBriefStructure(payload.content || (payload.filePath ? fs.readFileSync(safeInputPath(rootDir, payload.filePath), 'utf8') : fs.readFileSync(resolveCanonicalIdeaArtifact(rootDir).absolutePath, 'utf8'))));
    case 'idea-state': return output(computeIdeaStageState(rootDir));
    case 'idea-persist': {
      const disc = loadDiscoveryState(rootDir);
      return output(persistCanonicalIdeaBrief({
        rootDir,
        content: payload.content,
        discoveryRevision: disc.revision,
        discoveryFingerprint: disc.fingerprint,
      }));
    }
    case 'idea-record-candidate': return output(recordRequirementCandidate(rootDir, payload));
    case 'idea-confirm-candidate': {
      return output(consumeRequirementConfirmation(rootDir, {
        action: 'CONFIRM',
        confirmedBy: payload.confirmedBy,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-adopt-candidate': {
      return output(consumeRequirementConfirmation(rootDir, {
        action: 'CONFIRM',
        confirmedBy: payload.confirmedBy,
        allowAdoption: true,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-reject-candidate': {
      return output(consumeRequirementRejection(rootDir, {
        id: payload.id,
        confirmedBy: payload.confirmedBy,
        reason: payload.reason,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-confirm-requirements': return output(consumeRequirementConfirmation(rootDir, payload));
    case 'idea-supersede-candidate': {
      return output(consumeRequirementModification(rootDir, {
        oldId: payload.oldId,
        newCandidate: payload.newCandidate,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-classify-scope': {
      return output(consumeScopeConfirmation(rootDir, {
        scopeMapping: payload.scopeMapping || (payload.id ? { [payload.id]: payload.scopeDisposition } : {}),
        confirmedBy: payload.confirmedBy,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-confirm-scope': return output(consumeScopeConfirmation(rootDir, payload));
    case 'idea-record-question': return output(recordOpenQuestion(rootDir, payload));
    case 'idea-resolve-question': {
      return output(consumeDiscoveryQuestionResponse(rootDir, {
        questionId: payload.id || payload.questionId,
        resolution: payload.resolution,
        resolvedBy: payload.resolvedBy,
        deferredTarget: payload.deferredTarget,
        notes: payload.notes,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-supersede-question': {
      return output(consumeQuestionSupersession(rootDir, {
        oldId: payload.oldId,
        newQuestion: payload.newQuestion,
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-discovery-eval': return output(evaluateDiscoveryReadiness(rootDir));
    case 'idea-approve': {
      return output(consumeBriefApproval(rootDir, {
        approvingAuthority: payload.approvingAuthority,
        linkedPodIds: payload.linkedPodIds || [],
        expectedInteractionFingerprint: payload.expectedInteractionFingerprint,
      }));
    }
    case 'idea-workflow-state': return output(resolveIdeaWorkflowState(rootDir));
    case 'idea-checkpoint-load': return output(loadWorkflowCheckpoint(rootDir));
    case 'idea-checkpoint-persist': return output(presentCurrentInteraction(rootDir, payload));
    case 'idea-present-interaction': return output(presentCurrentInteraction(rootDir, payload));
    case 'idea-design-setup': return output(recordDesignAuthoritySetup(rootDir, payload));
    case 'idea-challenge-response': return output(recordIdeaChallengeResponse(rootDir, payload));
    case 'artifact-resolve': return output(resolveCanonicalIdeaArtifact(rootDir));
    case 'artifact-reconcile': return output(reconcileCanonicalIdeaBrief({ rootDir }));
    default: throw new Error(`Unsupported orchestration operation: ${operation}`);
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
