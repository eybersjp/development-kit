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
  validateIdeaBriefStructure,
  computeIdeaStageState,
  resolveCanonicalIdeaArtifact,
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
    case 'idea-validate': return output(validateIdeaBriefStructure(payload.content || (payload.filePath ? fs.readFileSync(safeInputPath(rootDir, payload.filePath), 'utf8') : fs.readFileSync(resolveCanonicalIdeaArtifact(rootDir).absolutePath, 'utf8'))));
    case 'idea-state': return output(computeIdeaStageState(rootDir));
    case 'idea-persist': return output(persistCanonicalIdeaBrief({ rootDir, content: payload.content }));
    case 'artifact-resolve': return output(resolveCanonicalIdeaArtifact(rootDir));
    default: throw new Error(`Unsupported orchestration operation: ${operation}`);
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
