#!/usr/bin/env node

/**
 * Development Kit - Plugin Sync
 *
 * Synchronises the committed Antigravity plugin mirror with canonical root
 * content and keeps plugin.json aligned with canonical skills, agents, and hooks.
 *
 * Usage:
 *   node scripts/sync-plugin.mjs         # Synchronise mirror + manifest
 *   node scripts/sync-plugin.mjs --check # Verify only, no changes
 *   node scripts/sync-plugin.mjs --fix   # Synchronise mirror + manifest
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PLUGIN_DIR = join(ROOT, '.agents', 'plugins', 'development-kit');
const PLUGIN_PATH = join(PLUGIN_DIR, 'plugin.json');
const MIRROR_DIRS = ['skills', 'agents', 'commands', 'hooks'];

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');

function getRelativePath(from, to) {
  const rel = relative(from, to).replace(/\\/g, '/');
  return rel.startsWith('..') ? rel : `./${rel}`;
}

function generatePluginJson() {
  const skillsDir = join(ROOT, 'skills');
  const agentsDir = join(ROOT, 'agents');
  const hooksDir = join(ROOT, 'hooks');

  const skills = readdirSync(skillsDir)
    .filter((name) => statSync(join(skillsDir, name)).isDirectory() && existsSync(join(skillsDir, name, 'SKILL.md')))
    .sort()
    .map((name) => getRelativePath(PLUGIN_DIR, join(skillsDir, name)));

  const agents = readdirSync(agentsDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => getRelativePath(PLUGIN_DIR, join(agentsDir, name)));

  const hooks = readdirSync(hooksDir)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => getRelativePath(PLUGIN_DIR, join(hooksDir, name)));

  return {
    name: 'development-kit',
    version: '0.1.0',
    description: 'Opinionated AI software-development methodology and skill collection for Antigravity.',
    author: 'development-kit contributors',
    skills,
    agents,
    hooks,
  };
}

function listFiles(baseDir, prefix = '') {
  if (!existsSync(baseDir)) return [];

  const files = [];
  for (const name of readdirSync(baseDir).sort()) {
    const absolute = join(baseDir, name);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...listFiles(absolute, relativePath));
    } else if (stat.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function compareManifest() {
  const issues = [];
  const generated = generatePluginJson();

  if (!existsSync(PLUGIN_PATH)) {
    issues.push('plugin.json is missing');
    return { generated, issues };
  }

  let current;
  try {
    current = JSON.parse(readFileSync(PLUGIN_PATH, 'utf8'));
  } catch (error) {
    issues.push(`plugin.json is invalid JSON: ${error.message}`);
    return { generated, issues };
  }

  if (JSON.stringify(current) !== JSON.stringify(generated)) {
    issues.push('plugin.json differs from the generated canonical manifest');
  }

  return { generated, current, issues };
}

export function normalizeLineEndings(content) {
  return typeof content === 'string' ? content.replace(/\r\n/g, '\n') : content;
}

export function contentsMatchIgnoringLineEndings(canonical, mirrored) {
  if (typeof canonical !== 'string' || typeof mirrored !== 'string') {
    return canonical === mirrored;
  }
  return normalizeLineEndings(canonical) === normalizeLineEndings(mirrored);
}

function compareMirrorDirectory(name) {
  const canonicalDir = join(ROOT, name);
  const mirrorDir = join(PLUGIN_DIR, name);
  const issues = [];

  if (!existsSync(canonicalDir)) {
    issues.push(`${name}: canonical directory is missing`);
    return issues;
  }

  if (!existsSync(mirrorDir)) {
    issues.push(`${name}: mirror directory is missing`);
    return issues;
  }

  const canonicalFiles = listFiles(canonicalDir);
  const mirrorFiles = listFiles(mirrorDir);
  const canonicalSet = new Set(canonicalFiles);
  const mirrorSet = new Set(mirrorFiles);

  for (const file of canonicalFiles) {
    if (!mirrorSet.has(file)) {
      issues.push(`${name}: mirror missing ${file}`);
      continue;
    }

    const canonical = readFileSync(join(canonicalDir, file), 'utf-8');
    const mirrored = readFileSync(join(mirrorDir, file), 'utf-8');
    if (!contentsMatchIgnoringLineEndings(canonical, mirrored)) {
      issues.push(`${name}: content differs for ${file}`);
    }
  }

  for (const file of mirrorFiles) {
    if (!canonicalSet.has(file)) {
      issues.push(`${name}: mirror has extra ${file}`);
    }
  }

  return issues;
}

function verifyState() {
  const { generated, issues: manifestIssues } = compareManifest();
  const mirrorIssues = MIRROR_DIRS.flatMap(compareMirrorDirectory);
  const issues = [...manifestIssues, ...mirrorIssues];

  console.log('Plugin synchronization check:');
  console.log(`  Skills: ${generated.skills.length} canonical`);
  console.log(`  Agents: ${generated.agents.length} canonical`);
  console.log(`  Commands: ${listFiles(join(ROOT, 'commands')).length} canonical files`);
  console.log(`  Hooks: ${generated.hooks.length} canonical`);

  if (issues.length > 0) {
    console.log('\nSynchronization issues:');
    for (const issue of issues) console.log(`  - ${issue}`);
    return false;
  }

  console.log('\n  ✓ Plugin manifest and committed mirror are in sync');
  return true;
}

function synchronizeMirror() {
  mkdirSync(PLUGIN_DIR, { recursive: true });

  for (const name of MIRROR_DIRS) {
    const source = join(ROOT, name);
    const target = join(PLUGIN_DIR, name);
    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
  }

  const generated = generatePluginJson();
  writeFileSync(PLUGIN_PATH, `${JSON.stringify(generated, null, 2)}\n`);

  console.log('Plugin mirror synchronized from canonical content:');
  console.log(`  ${generated.skills.length} skills`);
  console.log(`  ${generated.agents.length} agents`);
  console.log(`  ${listFiles(join(ROOT, 'commands')).length} command files`);
  console.log(`  ${generated.hooks.length} hooks`);
}

function main() {
  if (CHECK_ONLY) {
    if (!verifyState()) process.exit(1);
    return;
  }

  synchronizeMirror();
  if (!verifyState()) process.exit(1);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
