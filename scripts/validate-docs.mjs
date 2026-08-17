#!/usr/bin/env node

/**
 * Development Kit — Documentation Validator
 *
 * Validates documentation completeness, link integrity, and coverage:
 * - Every command in commands/ has a reference page in docs/03-reference/commands/
 * - Every agent in agents/ has a reference page in docs/03-reference/agents/
 * - Every skill in skills/ has a reference page in docs/03-reference/skills/
 * - Every hook in hooks/ is documented in docs/03-reference/hooks/
 * - Every template in templates/ is documented in docs/03-reference/templates/
 * - Every evaluation in evals/ is documented in docs/03-reference/evaluations/
 * - Every script in scripts/ is documented in docs/03-reference/scripts/
 * - Check for broken relative links in docs/
 * - Check for forbidden placeholder markers (TODO, TBD, Lorem ipsum)
 * - Check for local file:/// URLs
 * - Verify docs/SUMMARY.md includes all doc pages
 *
 * Usage:
 *   node scripts/validate-docs.mjs [--root <path>]
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_ROOT = resolve(__dirname, '..');

function getAllFiles(dir, ext = '.md') {
  let files = [];
  if (!existsSync(dir)) return files;
  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      files = files.concat(getAllFiles(fullPath, ext));
    } else if (item.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function containsUnresolvedPlaceholders(text) {
  if (!text) return false;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Explanatory prose patterns (MUST PASS):
    // Sentences discussing, rejecting, or prohibiting placeholders
    // (e.g. "Do not use TBD placeholders", "must not contain TODO or TBD", "rather than unresolved TBD",
    //  "avoid placeholder content such as TODO, TBD, or Lorem ipsum", "prohibits TBD")
    const isExplanatoryProse =
      /\b(?:do\s+not|must\s+not|should\s+not|never|no\s+|avoid|rejects?|rejecting|prohibits?|prohibited|without|rather\s+than|such\s+as|discuss(?:es|ing)?|containing|words?|terms?|placeholders?|markers?)\b/i.test(line) ||
      /\b(?:TODO|TBD)\b\s+(?:placeholders?|markers?|terminology|values?|decisions?)/i.test(line) ||
      /(?:left\s+as|marked\s+as|unresolved)\s+[`"']?(?:TODO|TBD)[`"']?/i.test(line);

    if (isExplanatoryProse) {
      continue;
    }

    // 1. Strict match on Lorem ipsum (actual latin filler text) unless part of explanatory sentence
    if (/\blorem\s+ipsum\b/i.test(line)) {
      return true;
    }

    // Check if line contains TODO or TBD
    if (!/\b(TODO|TBD)\b/i.test(line)) {
      continue;
    }

    // A. Explicit unresolved placeholder patterns:
    // Standalone TODO / TBD (e.g. "TODO", "TBD", "`TBD`", "[TBD]", "<TBD>", "{{TBD}}", "(TBD)")
    if (/^(?:[-*+]\s+|\d+\.\s+)?(?:[\[<{(«`"']\s*)?(?:TODO|TBD)(?:\s*[\]>)}»"'])?[:.?!]?$/i.test(line)) {
      return true;
    }

    // Key-value / field assignment placeholder (e.g. "Status: TBD", "Owner: [TODO]", "Due Date: `TBD`")
    if (/^[A-Za-z0-9_\s\-\.\/]+:\s*(?:[\[<{(«`"']\s*)?(?:TODO|TBD)(?:\s*[\]>)}»"'])?\.?$/i.test(line)) {
      return true;
    }

    // Table cell standalone placeholder (e.g. "| Component | TBD | ... |")
    if (/\|\s*(?:[\[<{(«`"']\s*)?(?:TODO|TBD)(?:\s*[\]>)}»"'])?\s*\|/i.test(line)) {
      return true;
    }

    // Markdown heading placeholder (e.g. "## TBD", "### TODO", "## [TBD]")
    if (/^#{1,6}\s+(?:[\[<{(«`"']\s*)?(?:TODO|TBD)(?:\s*[\]>)}»"'])?$/i.test(line)) {
      return true;
    }

    // Actionable task marker (e.g. "TODO: fix this", "TODO(user): ...", "TODO - implement", "TBD: details")
    if (/\b(?:TODO|TBD)(?:\([^)]*\))?\s*[:\-–—]\s*\S+/i.test(line)) {
      return true;
    }

    // Placeholder in bracketed/template forms (e.g. "[TBD]", "<TBD>", "{{TBD}}", "{{TODO}}", "{TBD}")
    if (/[\[<{]{1,2}\s*(?:TODO|TBD)\s*[\]>}]{1,2}/i.test(line)) {
      return true;
    }

    // If it's not recognized as explanatory prose and has raw unmatched TODO/TBD, treat as unresolved placeholder
    return true;
  }

  return false;
}

export function validateDocs(targetRoot = DEFAULT_ROOT, options = { silent: false }) {
  const docsDir = join(targetRoot, 'docs');
  let errors = [];
  let warnings = [];
  let passCount = 0;

  function error(msg) {
    errors.push(msg);
    if (!options.silent) console.error(`  ✗ ${msg}`);
  }

  function warn(msg) {
    warnings.push(msg);
    if (!options.silent) console.warn(`  ⚠ ${msg}`);
  }

  function pass(msg) {
    passCount++;
    if (!options.silent) console.log(`  ✓ ${msg}`);
  }

  if (!existsSync(docsDir)) {
    error('docs/ directory does not exist!');
    return { passCount, warnings, errors };
  }

  if (!options.silent) console.log('\n--- Documentation Coverage Checks ---');

  // Check Commands
  const commandsDir = join(targetRoot, 'commands');
  const commands = existsSync(commandsDir) ? readdirSync(commandsDir).filter(f => f.endsWith('.md')) : [];
  for (const cmd of commands) {
    const cmdName = cmd.replace('.md', '');
    const refFile = join(docsDir, '03-reference', 'commands', `${cmdName}.md`);
    if (existsSync(refFile)) {
      pass(`Command reference page exists: ${cmdName}.md`);
    } else {
      error(`Missing command reference page for: ${cmdName}`);
    }
  }

  // Check Agents
  const agentsDir = join(targetRoot, 'agents');
  const agents = existsSync(agentsDir) ? readdirSync(agentsDir).filter(f => f.endsWith('.md')) : [];
  for (const agent of agents) {
    const agentName = agent.replace('.md', '');
    const refFile = join(docsDir, '03-reference', 'agents', `${agentName}.md`);
    if (existsSync(refFile)) {
      pass(`Agent reference page exists: ${agentName}.md`);
    } else {
      error(`Missing agent reference page for: ${agentName}`);
    }
  }

  // Check Skills
  const skillsDir = join(targetRoot, 'skills');
  const skills = existsSync(skillsDir) ? readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory()) : [];
  for (const skill of skills) {
    const refFile = join(docsDir, '03-reference', 'skills', `${skill}.md`);
    if (existsSync(refFile)) {
      pass(`Skill reference page exists: ${skill}.md`);
    } else {
      error(`Missing skill reference page for: ${skill}`);
    }
  }

  // Check Hooks
  const hooksDir = join(targetRoot, 'hooks');
  const hooks = existsSync(hooksDir) ? readdirSync(hooksDir).filter(f => f.endsWith('.js')) : [];
  for (const hook of hooks) {
    const hookName = hook.replace('.js', '');
    const refFile = join(docsDir, '03-reference', 'hooks', `${hookName}.md`);
    if (existsSync(refFile)) {
      pass(`Hook reference page exists: ${hookName}.md`);
    } else {
      error(`Missing hook reference page for: ${hookName}`);
    }
  }

  // Check Templates
  const tplDir = join(targetRoot, 'templates');
  const templates = existsSync(tplDir) ? readdirSync(tplDir).filter(f => f.endsWith('.md')) : [];
  for (const tpl of templates) {
    const tplName = tpl.replace('.md', '');
    const refFile = join(docsDir, '03-reference', 'templates', `${tplName}.md`);
    if (existsSync(refFile)) {
      pass(`Template reference page exists: ${tplName}.md`);
    } else {
      error(`Missing template reference page for: ${tplName}`);
    }
  }

  // Check Evals
  const evalsDir = join(targetRoot, 'evals');
  const evals = existsSync(evalsDir) ? readdirSync(evalsDir).filter(d => statSync(join(evalsDir, d)).isDirectory()) : [];
  for (const ev of evals) {
    const refFile = join(docsDir, '03-reference', 'evaluations', `${ev}.md`);
    if (existsSync(refFile)) {
      pass(`Evaluation reference page exists: ${ev}.md`);
    } else {
      error(`Missing evaluation reference page for: ${ev}`);
    }
  }

  // Check Scripts
  const scriptsDir = join(targetRoot, 'scripts');
  const scripts = existsSync(scriptsDir) ? readdirSync(scriptsDir).filter(f => f.endsWith('.mjs') && !f.endsWith('.test.mjs')) : [];
  for (const script of scripts) {
    const scriptName = script.replace('.mjs', '');
    const refFile = join(docsDir, '03-reference', 'scripts', `${scriptName}.md`);
    if (existsSync(refFile)) {
      pass(`Script reference page exists: ${scriptName}.md`);
    } else {
      error(`Missing script reference page for: ${scriptName}`);
    }
  }

  if (!options.silent) console.log('\n--- Content & Link Integrity Checks ---');
  const allDocFiles = getAllFiles(docsDir);

  const summaryPath = join(docsDir, 'SUMMARY.md');
  const summaryContent = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf-8') : '';

  for (const filePath of allDocFiles) {
    const relPath = relative(docsDir, filePath).replace(/\\/g, '/');
    const content = readFileSync(filePath, 'utf-8');

    // Check for forbidden unresolved placeholders (TODO, TBD, Lorem ipsum)
    // Distinguishes actual unresolved placeholders from documentation discussing or prohibiting placeholders
    if (containsUnresolvedPlaceholders(content)) {
      error(`${relPath}: Contains placeholder text (TODO, TBD, or Lorem ipsum)`);
    }

    // Check for local file:/// URLs
    if (/file:\/\/\/[^\s\)]+/.test(content)) {
      error(`${relPath}: Contains local file:/// URL`);
    }

    // Check if included in SUMMARY.md
    if (relPath !== 'SUMMARY.md' && summaryContent) {
      if (!summaryContent.includes(relPath)) {
        error(`${relPath}: Not linked in docs/SUMMARY.md`);
      }
    }

    // Validate relative links inside markdown [text](target.md)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[2].trim();
      if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#') || target.startsWith('mailto:')) {
        continue;
      }
      const cleanTarget = target.split('#')[0];
      if (!cleanTarget) continue;

      const targetPath = resolve(dirname(filePath), cleanTarget);
      if (!existsSync(targetPath)) {
        error(`${relPath}: Broken link to '${target}'`);
      }
    }
  }

  // Active Version Consistency Checks
  const pkgJsonPath = join(targetRoot, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const activeVersion = pkg.version;
      if (activeVersion) {
        if (!options.silent) console.log('\n--- Active Version Consistency Checks ---');

        const activeVersionFiles = [
          { file: 'README.md', pattern: new RegExp(`v${activeVersion.replace(/\./g, '\\.')}|development-kit@${activeVersion.replace(/\./g, '\\.')}`) },
          { file: '01-overview/framework-at-a-glance.md', pattern: new RegExp(`\\b${activeVersion.replace(/\./g, '\\.')}\\b`) },
          { file: '01-overview/what-is-development-kit.md', pattern: new RegExp(`development-kit@${activeVersion.replace(/\./g, '\\.')}`) },
          { file: '02-user-guide/prerequisites.md', pattern: new RegExp(`development-kit@${activeVersion.replace(/\./g, '\\.')}`) },
          { file: '02-user-guide/verifying-installation.md', pattern: new RegExp(`\\b${activeVersion.replace(/\./g, '\\.')}\\b`) },
          { file: '03-reference/configuration/manifests-and-configs.md', pattern: new RegExp(`\\b${activeVersion.replace(/\./g, '\\.')}\\b`) },
          { file: '08-maintenance-release/npm-publishing.md', pattern: new RegExp(`\\b${activeVersion.replace(/\./g, '\\.')}\\b`) }
        ];

        for (const { file, pattern } of activeVersionFiles) {
          const docPath = join(docsDir, file);
          if (existsSync(docPath)) {
            const docContent = readFileSync(docPath, 'utf-8');
            if (pattern.test(docContent)) {
              pass(`Active version ${activeVersion} declared in docs/${file}`);
            } else {
              error(`docs/${file}: Does not declare current active package version ${activeVersion}`);
            }
          }
        }
      }
    } catch (_) {}
  }

  return { passCount, warnings, errors };
}

function main() {
  const args = process.argv.slice(2);
  let rootArg = DEFAULT_ROOT;
  const rootIdx = args.indexOf('--root');
  if (rootIdx !== -1 && args[rootIdx + 1]) {
    rootArg = resolve(args[rootIdx + 1]);
  }

  console.log('=== Development Kit Documentation Validator ===');
  const res = validateDocs(rootArg, { silent: false });

  console.log('\n=== Summary ===');
  console.log(`  ${res.passCount} checks passed`);
  if (res.warnings.length > 0) console.log(`  ${res.warnings.length} warnings`);
  if (res.errors.length > 0) console.log(`  ${res.errors.length} errors`);

  process.exit(res.errors.length > 0 ? 1 : 0);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isMainModule) {
  main();
}
