#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimateTextTokens } from '../runtime/orchestration/token-efficiency.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PRIORITY_RUNTIME_SKILLS = Object.freeze([
  'skills/using-development-kit/SKILL.md',
  'skills/context-packing/SKILL.md',
  'skills/repository-orientation/SKILL.md',
  'skills/subagent-driven-implementation/SKILL.md',
  'skills/existing-code-first/SKILL.md',
  'skills/native-platform-first/SKILL.md',
  'skills/dependency-restraint/SKILL.md',
  'skills/minimal-diff/SKILL.md',
  'skills/verification-before-completion/SKILL.md',
  'skills/test-driven-development/SKILL.md',
]);

const IMPLEMENTATION_HOT_PATH = Object.freeze([
  'AGENTS.md',
  'agents/development-conductor.md',
  'commands/dk-autopilot.md',
  'skills/using-development-kit/SKILL.md',
  'skills/native-platform-first/SKILL.md',
  'skills/dependency-restraint/SKILL.md',
  'skills/minimal-diff/SKILL.md',
  'commands/dk-build.md',
  'skills/repository-orientation/SKILL.md',
  'skills/verification-before-completion/SKILL.md',
  'skills/context-packing/SKILL.md',
  'commands/dk-build-auto.md',
  'skills/subagent-driven-implementation/SKILL.md',
  'skills/existing-code-first/SKILL.md',
  'agents/repository-scout-agent.md',
  'commands/dk-test.md',
  'agents/implementation-agent.md',
  'agents/test-engineer.md',
  'agents/spec-reviewer.md',
  'agents/code-reviewer.md',
]);

export const TOKEN_AUDIT_BASELINE = Object.freeze({
  estimator: 'chars-div-4-v1',
  preHardeningPrioritySkills: 10436,
  prioritySkillBudget: 5739,
  preHardeningImplementationHotPath: 19994,
  implementationHotPathBudget: 15000,
});

function listFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const absolute = path.join(dir, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) out.push(...listFiles(absolute, predicate));
    else if (stat.isFile() && predicate(absolute)) out.push(absolute);
  }
  return out;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fileStat(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  const fileContent = fs.readFileSync(absolute, 'utf8');
  return {
    path: relativePath,
    chars: fileContent.length,
    estimatedTokens: estimateTextTokens(fileContent),
  };
}

function categoryStats() {
  const skillSuffix = path.sep + 'SKILL.md';
  const categories = {
    rootRules: [path.join(ROOT, 'AGENTS.md')],
    skills: listFiles(path.join(ROOT, 'skills'), (file) => file.endsWith(skillSuffix)),
    agents: listFiles(path.join(ROOT, 'agents'), (file) => file.endsWith('.md')),
    commands: listFiles(path.join(ROOT, 'commands'), (file) => file.endsWith('.md')),
  };

  return Object.fromEntries(Object.entries(categories).map(([name, files]) => {
    const stats = files.map((file) => fileStat(relative(file)));
    return [name, {
      files: stats.length,
      estimatedTokens: stats.reduce((sum, item) => sum + item.estimatedTokens, 0),
    }];
  }));
}

export function buildTokenAudit() {
  const skillSuffix = path.sep + 'SKILL.md';
  const priority = PRIORITY_RUNTIME_SKILLS.map(fileStat);
  const hotPath = IMPLEMENTATION_HOT_PATH.map(fileStat);
  const allInstructionFiles = [
    fileStat('AGENTS.md'),
    ...listFiles(path.join(ROOT, 'skills'), (file) => file.endsWith(skillSuffix)).map((file) => fileStat(relative(file))),
    ...listFiles(path.join(ROOT, 'agents'), (file) => file.endsWith('.md')).map((file) => fileStat(relative(file))),
    ...listFiles(path.join(ROOT, 'commands'), (file) => file.endsWith('.md')).map((file) => fileStat(relative(file))),
  ];
  const largest = [...allInstructionFiles]
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 15);

  const priorityTokens = priority.reduce((sum, item) => sum + item.estimatedTokens, 0);
  const hotPathTokens = hotPath.reduce((sum, item) => sum + item.estimatedTokens, 0);

  return {
    estimator: TOKEN_AUDIT_BASELINE.estimator,
    note: 'Estimated tokens are deterministic chars/4 approximations, not provider billing records.',
    categories: categoryStats(),
    priorityRuntimeSkills: {
      files: priority,
      baseline: TOKEN_AUDIT_BASELINE.preHardeningPrioritySkills,
      current: priorityTokens,
      target: TOKEN_AUDIT_BASELINE.prioritySkillBudget,
      reductionPercent: Number(((1 - (priorityTokens / TOKEN_AUDIT_BASELINE.preHardeningPrioritySkills)) * 100).toFixed(2)),
      withinBudget: priorityTokens <= TOKEN_AUDIT_BASELINE.prioritySkillBudget,
    },
    implementationHotPath: {
      files: hotPath,
      baseline: TOKEN_AUDIT_BASELINE.preHardeningImplementationHotPath,
      current: hotPathTokens,
      target: TOKEN_AUDIT_BASELINE.implementationHotPathBudget,
      reductionPercent: Number(((1 - (hotPathTokens / TOKEN_AUDIT_BASELINE.preHardeningImplementationHotPath)) * 100).toFixed(2)),
      withinBudget: hotPathTokens <= TOKEN_AUDIT_BASELINE.implementationHotPathBudget,
    },
    largestInstructionFiles: largest,
  };
}

function printHuman(report) {
  console.log('DKF Token & Context Audit');
  console.log('Estimator: ' + report.estimator);
  console.log(report.note);
  console.log('');
  console.log('Canonical instruction categories:');
  for (const [name, value] of Object.entries(report.categories)) {
    console.log('  ' + name + ': ' + value.files + ' files / ~' + value.estimatedTokens + ' tokens');
  }
  console.log('');
  console.log(
    'Priority runtime skills: ~' + report.priorityRuntimeSkills.current + ' tokens '
    + '(baseline ' + report.priorityRuntimeSkills.baseline + ', reduction ' + report.priorityRuntimeSkills.reductionPercent
    + '%, target <= ' + report.priorityRuntimeSkills.target + ')',
  );
  console.log(
    'Implementation hot path: ~' + report.implementationHotPath.current + ' tokens '
    + '(baseline ' + report.implementationHotPath.baseline + ', reduction ' + report.implementationHotPath.reductionPercent
    + '%, target <= ' + report.implementationHotPath.target + ')',
  );
  console.log('');
  console.log('Largest instruction files:');
  for (const item of report.largestInstructionFiles) {
    console.log('  ' + String(item.estimatedTokens).padStart(5) + '  ' + item.path);
  }
}

function main() {
  const report = buildTokenAudit();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHuman(report);
  }

  if (process.argv.includes('--check')) {
    const failures = [];
    if (!report.priorityRuntimeSkills.withinBudget) {
      failures.push(
        'Priority runtime skills exceed token budget: ' + report.priorityRuntimeSkills.current + ' > ' + report.priorityRuntimeSkills.target,
      );
    }
    if (!report.implementationHotPath.withinBudget) {
      failures.push(
        'Implementation hot path exceeds token budget: ' + report.implementationHotPath.current + ' > ' + report.implementationHotPath.target,
      );
    }
    if (failures.length > 0) {
      for (const failure of failures) console.error('TOKEN_BUDGET_FAIL: ' + failure);
      process.exitCode = 1;
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
