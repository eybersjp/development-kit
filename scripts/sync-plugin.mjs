#!/usr/bin/env node

/**
 * Development Kit — Plugin Sync
 *
 * Synchronises the Development Kit plugin with the Antigravity installation.
 * Updates plugin.json references, checks for missing files, and reports status.
 *
 * Usage:
 *   node scripts/sync-plugin.mjs         # Sync and report
 *   node scripts/sync-plugin.mjs --check # Check only, no changes
 *   node scripts/sync-plugin.mjs --fix   # Fix issues automatically
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const FIX = args.includes('--fix');

let issues = [];

function getRelativePath(from, to) {
  // Use path.relative() for reliable cross-platform relative path computation
  let rel = relative(from, to).replace(/\\/g, '/');
  return rel.startsWith('..') ? rel : './' + rel;
}

function generatePluginJson() {
  const skillsDir = join(ROOT, 'skills');
  const agentsDir = join(ROOT, 'agents');
  const hooksDir = join(ROOT, 'hooks');

  const pluginDir = join(ROOT, '.agents', 'plugins', 'development-kit');

  // Gather skills
  const skills = readdirSync(skillsDir)
    .filter((d) => statSync(join(skillsDir, d)).isDirectory() && existsSync(join(skillsDir, d, 'SKILL.md')))
    .map((d) => getRelativePath(pluginDir, join(skillsDir, d)));

  // Gather agents
  const agents = readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => getRelativePath(pluginDir, join(agentsDir, f)));

  // Gather hooks
  const hooks = readdirSync(hooksDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => getRelativePath(pluginDir, join(hooksDir, f)));

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

function main() {
  const pluginPath = join(ROOT, '.agents', 'plugins', 'development-kit', 'plugin.json');

  if (CHECK_ONLY) {
    if (existsSync(pluginPath)) {
      const current = JSON.parse(readFileSync(pluginPath, 'utf-8'));
      const generated = generatePluginJson();

      console.log('Plugin manifest check:');
      console.log(`  Skills: ${current.skills.length} defined, ${generated.skills.length} available`);
      console.log(`  Agents: ${current.agents.length} defined, ${generated.agents.length} available`);
      console.log(`  Hooks: ${current.hooks?.length || 0} defined, ${generated.hooks.length} available`);

      // Check for missing entries
      const missingSkills = generated.skills.filter((s) => !current.skills.includes(s));
      const missingAgents = generated.agents.filter((a) => !current.agents.includes(a));

      if (missingSkills.length > 0) {
        console.log(`\n  Missing skills: ${missingSkills.join(', ')}`);
      }
      if (missingAgents.length > 0) {
        console.log(`\n  Missing agents: ${missingAgents.join(', ')}`);
      }

      if (missingSkills.length === 0 && missingAgents.length === 0) {
        console.log('\n  ✓ Plugin is in sync');
      }
    } else {
      console.log('Plugin manifest not found. Run without --check to create it.');
    }
  } else if (FIX) {
    const generated = generatePluginJson();
    writeFileSync(pluginPath, JSON.stringify(generated, null, 2) + '\n');
    console.log(`Plugin manifest updated with:`);
    console.log(`  ${generated.skills.length} skills`);
    console.log(`  ${generated.agents.length} agents`);
    console.log(`  ${generated.hooks.length} hooks`);
  } else {
    const generated = generatePluginJson();
    writeFileSync(pluginPath, JSON.stringify(generated, null, 2) + '\n');
    console.log(`Plugin manifest synchronised:`);
    console.log(`  ${generated.skills.length} skills`);
    console.log(`  ${generated.agents.length} agents`);
    console.log(`  ${generated.hooks.length} hooks`);
  }
}

main();
