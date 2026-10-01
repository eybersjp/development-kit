#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

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
  discoverConfigurationRequirements,
  loadConfigurationRegistry,
  saveConfigurationRegistry,
  evaluateConfigurationReadiness,
  prepareConfigurationTargets,
  generateConfigurationSetupGuide,
  validateConfigurationRequirement,
  recordConfigurationDecision,
  saveConfigurationGateState,
  recordRequirementCandidate,
  recordOpenQuestion,
  loadDiscoveryState,
  loadIdeaDesignState,
  inspectIdeaBrief,
  loadIdeaWorkflow,
  ensurePendingIdeaInteraction,
  consumePendingIdeaInteraction,
  completeIdeaCustomInstruction,
  refreshStaleIdeaInteraction,
  persistCanonicalIdeaBrief,
} from '../runtime/orchestration/index.mjs';
import { reconcileCanonicalArtifact } from '../runtime/orchestration/reconciliation.mjs';

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

function readPayload(options, rootDir) {
  if (typeof options['input-json'] === 'string') return JSON.parse(options['input-json']);
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
  const rootDir = process.cwd();
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
    case 'idea-state': {
      const workflow = loadIdeaWorkflow(rootDir);
      return output({
        workflow,
        discovery: loadDiscoveryState(rootDir),
        design: loadIdeaDesignState(rootDir),
        artifact: inspectIdeaBrief(rootDir),
      });
    }
    case 'idea-next':
      return output(ensurePendingIdeaInteraction(rootDir));
    case 'idea-record-candidate': {
      const workflow = loadIdeaWorkflow(rootDir);
      if (workflow.pendingInteraction) throw new Error('Cannot mutate IDEA discovery while a persisted interaction is pending');
      return output(recordRequirementCandidate(rootDir, payload));
    }
    case 'idea-record-question': {
      const workflow = loadIdeaWorkflow(rootDir);
      if (workflow.pendingInteraction) throw new Error('Cannot mutate IDEA discovery while a persisted interaction is pending');
      return output(recordOpenQuestion(rootDir, payload));
    }
    case 'idea-consume':
      return output(consumePendingIdeaInteraction(rootDir, payload));
    case 'idea-custom-complete':
      return output(completeIdeaCustomInstruction(rootDir, payload));
    case 'idea-refresh-stale':
      return output(refreshStaleIdeaInteraction(rootDir, payload));
    case 'idea-persist-brief': {
      const workflow = loadIdeaWorkflow(rootDir);
      if (workflow.pendingInteraction || workflow.currentPhase !== 'BRIEF_DRAFT') {
        throw new Error('Idea Brief may only be persisted from BRIEF_DRAFT with no pending interaction');
      }
      const record = persistCanonicalIdeaBrief(rootDir, payload);
      return output({ record, workflow: ensurePendingIdeaInteraction(rootDir) });
    }
    case 'configuration-readiness': {
      const targetRoot = payload.rootDir || rootDir;
      const action = options.action || payload.action || 'status';
      switch (action) {
        case 'discover': {
          const existing = loadConfigurationRegistry(targetRoot).requirements;
          const discovered = discoverConfigurationRequirements({
            rootDir: targetRoot,
            contract: payload.contract || null,
            task: payload.task || null,
            plan: payload.plan || null,
            existingRequirements: existing,
          });
          saveConfigurationRegistry({ requirements: discovered }, targetRoot);
          const gate = evaluateConfigurationReadiness({
            rootDir: targetRoot,
            requirements: discovered,
            activeContractId: payload.contractId || payload.contract?.contractId || null,
            activeRunId: payload.runId || null,
          });
          saveConfigurationGateState(gate, targetRoot);
          generateConfigurationSetupGuide(targetRoot, discovered);
          return output({ requirements: discovered, gate });
        }
        case 'status': {
          const reg = loadConfigurationRegistry(targetRoot);
          const gate = evaluateConfigurationReadiness({
            rootDir: targetRoot,
            requirements: reg.requirements,
            activeContractId: payload.contractId || null,
            activeRunId: payload.runId || null,
          });
          return output({ requirements: reg.requirements, gate });
        }
        case 'prepare': {
          const reg = loadConfigurationRegistry(targetRoot);
          const prep = prepareConfigurationTargets(targetRoot, reg.requirements);
          saveConfigurationRegistry(reg, targetRoot);
          generateConfigurationSetupGuide(targetRoot, reg.requirements);
          return output(prep);
        }
        case 'validate': {
          const reg = loadConfigurationRegistry(targetRoot);
          const reqId = payload.requirementId;
          const req = reg.requirements.find((r) => r.id === reqId || r.name === reqId);
          if (!req) throw new Error(`Requirement not found: ${reqId}`);
          const result = validateConfigurationRequirement(targetRoot, req);
          req.status = result.status;
          saveConfigurationRegistry(reg, targetRoot);
          const gate = evaluateConfigurationReadiness({
            rootDir: targetRoot,
            requirements: reg.requirements,
            activeContractId: payload.contractId || null,
            activeRunId: payload.runId || null,
          });
          saveConfigurationGateState(gate, targetRoot);
          return output({ requirement: req, validation: result, gate });
        }
        case 'decision': {
          const result = recordConfigurationDecision({
            rootDir: targetRoot,
            requirementId: payload.requirementId,
            decision: payload.decision,
            confirmed: payload.confirmed !== false,
            contractId: payload.contractId || null,
            sourceFingerprint: payload.sourceFingerprint || null,
            authority: payload.authority || 'product-owner',
          });
          const reg = loadConfigurationRegistry(targetRoot);
          const gate = evaluateConfigurationReadiness({
            rootDir: targetRoot,
            requirements: reg.requirements,
            activeContractId: payload.contractId || null,
            activeRunId: payload.runId || null,
          });
          saveConfigurationGateState(gate, targetRoot);
          generateConfigurationSetupGuide(targetRoot, reg.requirements);
          return output({ result, gate });
        }
        default: throw new Error(`Unsupported configuration-readiness action: ${action}`);
      }
    }
    default: throw new Error(`Unsupported orchestration operation: ${operation}`);
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
