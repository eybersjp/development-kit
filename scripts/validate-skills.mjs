#!/usr/bin/env node

/**
 * Development Kit — Skill Validator
 *
 * Validates that all skill and agent files have the required structure:
 * - Each SKILL.md has a valid YAML frontmatter block with name and description
 * - Each agent .md file has a valid structure
 * - All references in plugin.json point to existing files
 *
 * Usage:
 *   node scripts/validate-skills.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let errors = [];
let warnings = [];
let passCount = 0;

function error(msg) {
  errors.push(msg);
  console.error(`  ✗ ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
}

function pass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w+):\s*(.+)$/);
    if (kvMatch) {
      result[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, '');
    }
  }

  return result;
}

function validateSkill(dir) {
  const skillName = dir.split(/[/\\]/).pop();
  const skillMdPath = join(dir, 'SKILL.md');

  console.log(`\nSkill: ${skillName}`);

  if (!existsSync(skillMdPath)) {
    error(`${skillMdPath}: Missing SKILL.md`);
    return;
  }

  const content = readFileSync(skillMdPath, 'utf-8');
  const frontmatter = parseYamlFrontmatter(content);

  if (!frontmatter) {
    error(`${skillMdPath}: Missing or invalid YAML frontmatter`);
    return;
  }

  if (!frontmatter.name) {
    error(`${skillMdPath}: Missing 'name' in frontmatter`);
  } else {
    pass(`name: ${frontmatter.name}`);
  }

  if (!frontmatter.description) {
    error(`${skillMdPath}: Missing 'description' in frontmatter`);
  } else {
    pass(`description present`);
  }

  // Check required sections
  const requiredSections = ['Overview', 'Process'];
  for (const section of requiredSections) {
    if (content.includes(`# ${section}`) || content.includes(`## ${section}`)) {
      pass(`Section: ${section}`);
    } else {
      warn(`${skillMdPath}: Missing recommended section '${section}'`);
    }
  }
}

function validateAgent(filePath) {
  const agentName = filePath.split(/[/\\]/).pop().replace('.md', '');

  console.log(`\nAgent: ${agentName}`);

  if (!existsSync(filePath)) {
    error(`${filePath}: File not found`);
    return;
  }

  const content = readFileSync(filePath, 'utf-8');

  // Check for required role section
  if (content.includes('# ') && (content.includes('Role') || content.includes('Responsibilities'))) {
    pass(`Structure valid`);
  } else {
    warn(`${filePath}: Agent file should have a clear role/responsibilities section`);
  }
}

function validateCommand(filePath) {
  const commandName = filePath.split(/[/\\]/).pop().replace('.md', '');
  console.log(`\nCommand: ${commandName}`);

  if (!existsSync(filePath)) {
    error(`${filePath}: File not found`);
    return;
  }

  const content = readFileSync(filePath, 'utf-8');

  if (content.includes('---') && content.includes('name:')) {
    pass(`Frontmatter valid`);
  } else {
    warn(`${filePath}: Missing YAML frontmatter`);
  }

  if (content.includes('## Purpose') || content.includes('## Workflow')) {
    pass(`Structure valid`);
  }
}

function main() {
  console.log('=== Development Kit Validator ===\n');

  // Validate Skills
  const skillsDir = join(ROOT, 'skills');
  if (existsSync(skillsDir)) {
    console.log('--- Skills ---');
    const skills = readdirSync(skillsDir).filter((d) =>
      statSync(join(skillsDir, d)).isDirectory()
    );
    for (const skill of skills) {
      validateSkill(join(skillsDir, skill));
    }
  }

  // Validate Agents
  const agentsDir = join(ROOT, 'agents');
  if (existsSync(agentsDir)) {
    console.log('\n--- Agents ---');
    const agents = readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
    for (const agent of agents) {
      validateAgent(join(agentsDir, agent));
    }
  }

  // Validate Commands
  const commandsDir = join(ROOT, 'commands');
  if (existsSync(commandsDir)) {
    console.log('\n--- Commands ---');
    const commands = readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
    for (const command of commands) {
      validateCommand(join(commandsDir, command));
    }
  }

  // Validate plugin.json references
  const pluginJson = join(ROOT, '.agents', 'plugins', 'development-kit', 'plugin.json');
  if (existsSync(pluginJson)) {
    console.log('\n--- Plugin Manifest ---');
    const plugin = JSON.parse(readFileSync(pluginJson, 'utf-8'));

    if (plugin.name) pass(`Plugin name: ${plugin.name}`);
    if (plugin.version) pass(`Plugin version: ${plugin.version}`);

    // Check skill references
    if (plugin.skills) {
      for (const skillRef of plugin.skills) {
        const resolvedPath = resolve(dirname(pluginJson), skillRef, 'SKILL.md');
        if (existsSync(resolvedPath)) {
          pass(`Skill reference valid: ${skillRef}`);
        } else {
          error(`Skill reference not found: ${skillRef}`);
        }
      }
    }

    // Check agent references
    if (plugin.agents) {
      for (const agentRef of plugin.agents) {
        const resolvedPath = resolve(dirname(pluginJson), agentRef);
        if (existsSync(resolvedPath)) {
          pass(`Agent reference valid: ${agentRef}`);
        } else {
          error(`Agent reference not found: ${agentRef}`);
        }
      }
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`  ${passCount} checks passed`);
  if (warnings.length > 0) console.log(`  ${warnings.length} warnings`);
  if (errors.length > 0) console.log(`  ${errors.length} errors`);

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
