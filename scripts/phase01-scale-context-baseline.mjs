#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildTokenAudit } from './token-audit.mjs';
import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { buildContextPackage } from '../runtime/orchestration/context-package.mjs';
import { selectRequiredGates } from '../runtime/orchestration/gate-selector.mjs';
import { createInitialState } from '../runtime/autopilot/transition-model.mjs';
import { saveStateRevision, getStateDir } from '../runtime/autopilot/state-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function walk(root, { exclude = [] } = {}) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    const rel = path.relative(ROOT, absolute).replaceAll('\\', '/');
    if (exclude.some((prefix) => rel === prefix || rel.startsWith(prefix + '/'))) continue;
    if (entry.isDirectory()) out.push(...walk(absolute, { exclude }));
    else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      out.push({ path: rel, bytes: stat.size });
    }
  }
  return out;
}

function tempProject(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `dkf-phase01-${label}-`));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

function baseTask(id, objective, requiredVerification = ['tests']) {
  return {
    id,
    projectId: 'phase01-baseline',
    status: 'approved',
    objective,
    scope: { in: ['fixture/'], out: ['No production changes'] },
    requirements: [`REQ-${id}`],
    acceptanceCriteria: [{
      id: `AC-${id}`,
      statement: objective,
      source: `REQ-${id}`,
      verificationType: ['test'],
      requiredEvidence: true,
    }],
    architectureConstraints: [],
    designConstraints: [],
    securityConstraints: [],
    risk: { level: 1, reasons: ['Phase 0/1 synthetic benchmark'] },
    requiredVerification,
    requiredReviewers: ['code-reviewer'],
  };
}

function writeFixtureFiles(root, layout) {
  const paths = [];
  for (const [dir, count] of Object.entries(layout)) {
    for (let i = 1; i <= count; i += 1) {
      const file = path.join(root, dir, `file-${String(i).padStart(3, '0')}.js`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `export const value${i} = ${i};\n`, 'utf8');
      paths.push(path.relative(root, file).replaceAll('\\', '/'));
    }
  }
  return paths;
}

function contextFixture({ label, layout, relevantLines, unrelatedLines, repositoryState }) {
  const root = tempProject(label);
  try {
    const paths = writeFixtureFiles(root, layout);
    const req = `REQ-TASK-${label.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    const relevant = Array.from({ length: relevantLines }, (_, i) => `Required behaviour ${i + 1}.`);
    const unrelated = Array.from({ length: unrelatedLines }, (_, i) => `Unrelated project detail ${i + 1}.`);
    const spec = [
      '# Specification',
      '',
      `## ${req}`,
      ...relevant,
      '',
      '## REQ-UNRELATED',
      ...unrelated,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(root, 'docs', 'spec.md'), spec, 'utf8');

    const task = baseTask(`TASK-${label.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`, `Benchmark ${label}`);
    task.requirements = [req];
    task.acceptanceCriteria[0].source = req;

    const contract = createPolicyBoundDevelopmentContract({
      rootDir: root,
      task,
      authoritativeSources: [{
        path: 'docs/spec.md',
        kind: 'specification',
        authority: 'required',
        sections: [req],
      }],
    });

    const context = buildContextPackage({
      contract,
      role: 'implementation-agent',
      rootDir: root,
      repositoryState: {
        files: paths,
        ...repositoryState,
      },
    });

    const gates = selectRequiredGates(contract);
    return {
      workspaceFiles: paths.length,
      rawSourceTokens: context.tokenProfile.rawSourceTokens,
      deliveredSourceTokens: context.tokenProfile.deliveredSourceTokens,
      sourceSavingsPercent: context.tokenProfile.sourceSavingsPercent,
      estimatedPackageTokens: context.tokenProfile.estimatedPackageTokens,
      overBudget: context.tokenProfile.overBudget,
      deliveryMode: context.authoritativeSources[0].delivery.mode,
      selectedVerification: gates.verification,
      selectedReviewers: gates.reviewers,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function legacyStateFixture(revisions = 26) {
  const root = tempProject('legacy-state');
  try {
    const state = createInitialState({ autonomy: 'guided-autopilot' }, root);
    for (let revision = 1; revision <= revisions; revision += 1) {
      state.stateRevision = revision;
      state.updatedAt = new Date(Date.parse(state.createdAt) + revision * 1000).toISOString();
      saveStateRevision(state, root);
    }
    const stateDir = getStateDir(root);
    const files = fs.readdirSync(stateDir).filter((name) => fs.statSync(path.join(stateDir, name)).isFile());
    const revisionFiles = files.filter((name) => /^revision-\d{6}\.json$/.test(name));
    const bytes = files.reduce((sum, name) => sum + fs.statSync(path.join(stateDir, name)).size, 0);
    return {
      requestedRevisions: revisions,
      revisionFiles: revisionFiles.length,
      totalStateFiles: files.length,
      totalStateBytes: bytes,
      pointerFiles: files.filter((name) => name === 'current.json').length,
      filesPerRevisionApprox: Number((files.length / revisions).toFixed(3)),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const repoFiles = walk(ROOT, { exclude: ['.git', 'node_modules', 'website/node_modules', 'website/.next'] });
const tokenAudit = buildTokenAudit();

const singlePackage = contextFixture({
  label: 'single-package',
  layout: { src: 24, test: 8 },
  relevantLines: 10,
  unrelatedLines: 40,
  repositoryState: { topology: 'single-package' },
});

const multiPackage = contextFixture({
  label: 'multi-package',
  layout: {
    'apps/web/src': 80,
    'apps/mobile/src': 70,
    'packages/shared/src': 40,
    'packages/calculations/src': 50,
    'supabase/migrations': 25,
  },
  relevantLines: 12,
  unrelatedLines: 180,
  repositoryState: {
    topology: 'multi-package',
    packageRoots: ['apps/web', 'apps/mobile', 'packages/shared', 'packages/calculations', 'supabase'],
    note: 'Current context package has no first-class workspace target selector.',
  },
});

const calculationHeavy = contextFixture({
  label: 'calculation-heavy',
  layout: { 'src/engine': 90, 'test/golden': 60 },
  relevantLines: 30,
  unrelatedLines: 300,
  repositoryState: {
    topology: 'calculation-heavy',
    domain: 'engineering',
    note: 'Current gate selector has no domain/numerical verification profile.',
  },
});

const baseline = {
  schemaVersion: 1,
  phase: 'PHASE-0-AND-1',
  generatedAt: new Date().toISOString(),
  repository: 'eybersjp/development-kit',
  frameworkVersion: pkg.version,
  commit: gitSha(),
  platform: process.platform,
  node: process.version,
  releaseTargetFinding: {
    requestedSpecificationVersion: '0.11.0',
    currentRepositoryVersion: pkg.version,
    versionCollision: pkg.version !== '0.11.0',
    recommendedNextFeatureVersion: '0.12.0',
  },
  repositoryInventory: {
    files: repoFiles.length,
    bytes: repoFiles.reduce((sum, item) => sum + item.bytes, 0),
    testFiles: repoFiles.filter((item) => /\.test\.mjs$/.test(item.path)).length,
    instructionFiles: repoFiles.filter((item) =>
      item.path === 'AGENTS.md'
      || /^agents\/.*\.md$/.test(item.path)
      || /^commands\/.*\.md$/.test(item.path)
      || /^skills\/.*\/SKILL\.md$/.test(item.path)
    ).length,
  },
  tokenAudit: {
    estimator: tokenAudit.estimator,
    note: tokenAudit.note,
    priorityRuntimeSkills: tokenAudit.priorityRuntimeSkills,
    implementationHotPath: tokenAudit.implementationHotPath,
    categories: tokenAudit.categories,
  },
  representativeFixtures: {
    singlePackage,
    multiPackage,
    calculationHeavy,
    legacyState26Revisions: legacyStateFixture(26),
  },
  instrumentationCoverage: {
    providerTokenUsage: { available: false, value: null, reason: 'Current DKF runtime does not expose provider billing-token telemetry.' },
    repositoryReadCount: { available: false, value: null, reason: 'Current DKF runtime does not centrally instrument repository reads.' },
    repositoryScanCount: { available: false, value: null, reason: 'Current DKF runtime does not centrally instrument repository orientation scans.' },
    agentInvocationCount: { available: false, value: null, reason: 'Current DKF runtime does not centrally instrument host agent invocations.' },
    toolCallCount: { available: false, value: null, reason: 'Current DKF runtime does not centrally instrument host tool calls.' },
  },
};

const json = JSON.stringify(baseline, null, 2) + '\n';
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
if (outArg) {
  const outputPath = path.resolve(ROOT, outArg.slice('--out='.length));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, 'utf8');
}
process.stdout.write(json);
