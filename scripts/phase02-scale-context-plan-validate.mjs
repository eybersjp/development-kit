#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePlanModel } from '../runtime/orchestration/plan-validator.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = path.join(
  ROOT,
  'docs',
  '04-architecture',
  'dkf-scale-context-iteration-v0.12-plan-model.json',
);

const model = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));

const report = validatePlanModel({
  tasks: model.tasks,
  declaredTaskCount: model.declaredTaskCount,
  declaredDependencyEdges: model.declaredDependencyEdges,
  requiredResources: model.requiredResources,
  requiredAcceptanceCriteria: model.requiredAcceptanceCriteria,
  availableConfigurationRequirements: [],
});

const output = {
  planId: model.planId,
  planPath: path.relative(ROOT, PLAN_PATH).replaceAll('\\', '/'),
  ...report,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

if (!report.valid) {
  process.exitCode = 1;
}
