#!/usr/bin/env node

/**
 * Development Kit — Antigravity Installer
 *
 * Installs or links the Development Kit plugin into Antigravity.
 *
 * Usage:
 *   node scripts/install-antigravity.mjs
 *   node scripts/install-antigravity.mjs --global
 *   node scripts/install-antigravity.mjs --project
 *   node scripts/install-antigravity.mjs --all
 *   node scripts/install-antigravity.mjs --all --force
 *   node scripts/install-antigravity.mjs --opencode
 *
 * Options:
 *   --global   Install globally (~/.gemini/config/ or similar)
 *   --project  Install project-local (./.agents/)
 *   --all      Install everything to project root for standalone use
 *   --opencode Install skills and rules for OpenCode (.opencode/skills/)
 *   --force    Override existsSync guards (overwrite existing AGENTS.md, README.md)
 *   --dry-run  Show what would be installed without copying
 *   --help     Show help
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installPlatformAdapters,
  resolvePlatformSelection,
} from './install-platform-adapters.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PLATFORM_FLAGS = Object.freeze([
  '--claude',
  '--cursor',
  '--vscode',
  '--cline',
  '--windsurf',
  '--all-platforms',
]);
const KNOWN_FLAGS = new Set([
  '--global',
  '--project',
  '--all',
  '--opencode',
  '--force',
  '--dry-run',
  '--help',
  ...PLATFORM_FLAGS,
]);
const PLUGIN_DIRS_TO_COPY = Object.freeze([
  'skills',
  'agents',
  'hooks',
  'commands',
  'templates',
  'evals',
  'runtime',
  'schemas',
  'scripts',
]);

const HELP = `
Development Kit — Antigravity Installer

Installs the Development Kit plugin into Antigravity.

Usage:
  node scripts/install-antigravity.mjs [init] [options]

Options:
  --global   Install globally (~/.gemini/config/ or similar)
  --project  Install project-local (./.agents/)
  --all      Install everything to project root for standalone use
  --opencode Install skills and rules for OpenCode (.opencode/skills/)
  --claude   Install the Claude adapter
  --cursor   Install the Cursor adapter
  --vscode   Install the VS Code adapter
  --cline    Install the Cline adapter
  --windsurf Install the Windsurf adapter
  --all-platforms Install all five platform adapters
  --force    Override safety guards and overwrite existing files
  --dry-run  Show what would be installed without copying
  --help     Show this help message

If no option is provided, you will be prompted to choose.
`.trim();

function getPackageMetadata() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
}

function printCommands() {
  console.log('  /dk-autopilot  - Run the complete guided Development Kit lifecycle');
  console.log('  /dk-idea       - Refine a rough idea into a concrete concept');
  console.log('  /dk-research   - Gather source-backed external evidence safely');
  console.log('  /dk-spec       - Create the required specification artifacts');
  console.log('  /dk-design     - Produce technical and visual design');
  console.log('  /dk-design-system - Establish, inspect, verify, and govern the project design system');
  console.log('  /dk-tasks      - Break approved work into small tasks');
  console.log('  /dk-build      - Implement the next task through every gate');
  console.log('  /dk-build-auto - Process the entire plan automatically');
  console.log('  /dk-test       - Run verification');
  console.log('  /dk-review     - Run the full review cycle');
  console.log('  /dk-simplify   - Apply the simplicity ladder');
  console.log('  /dk-debug      - Systematic root-cause analysis');
  console.log('  /dk-ship       - Final verification and release preparation');
  console.log('  /dk-control    - Launch Development Kit Control Center web interface');
  console.log('  /dk-status     - Show current workflow state');
}

function detectAntigravity() {
  const possiblePaths = [
    join(process.env.HOME || process.env.USERPROFILE || '~', '.gemini', 'config'),
    join(process.cwd(), '.agents'),
    join(process.cwd(), '.gemini'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

function verifyPluginInstallation(pluginDir, expectedVersion) {
  const issues = [];
  const manifestPath = join(pluginDir, 'plugin.json');

  if (!existsSync(manifestPath)) {
    issues.push('plugin.json missing');
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.version !== expectedVersion) {
        issues.push(`plugin.json version ${manifest.version ?? 'missing'} does not match package ${expectedVersion}`);
      }
    } catch (error) {
      issues.push(`plugin.json invalid: ${error.message}`);
    }
  }

  for (const dir of PLUGIN_DIRS_TO_COPY) {
    if (!existsSync(join(pluginDir, dir))) issues.push(`${dir}/ missing`);
  }

  const runtimeProof = [
    'scripts/autopilot.mjs',
    'runtime/autopilot/state-store.mjs',
    'schemas/development-contract.schema.json',
  ];
  for (const relativePath of runtimeProof) {
    if (!existsSync(join(pluginDir, relativePath))) issues.push(`${relativePath} missing`);
  }

  if (issues.length > 0) {
    throw new Error(`Installed plugin integrity verification failed:\n  - ${issues.join('\n  - ')}`);
  }

  console.log(`  ✓ plugin integrity verified (version ${expectedVersion})`);
}

function installPlugin(targetDir, force = false, mode = 'project') {
  const pluginDir = join(targetDir, 'plugins', 'development-kit');
  const packageMetadata = getPackageMetadata();

  console.log(`Installing Development Kit plugin to: ${pluginDir}`);
  mkdirSync(pluginDir, { recursive: true });

  // DK owns these plugin subdirectories. Replace them rather than merging so
  // removed/stale files cannot survive an upgrade and masquerade as current.
  for (const dir of PLUGIN_DIRS_TO_COPY) {
    const src = join(ROOT, dir);
    const dst = join(pluginDir, dir);
    if (existsSync(src)) {
      rmSync(dst, { recursive: true, force: true });
      cpSync(src, dst, { recursive: true });
      console.log(`  ✓ ${dir}/ copied`);
    }
  }

  const sourcePluginJson = join(ROOT, '.agents', 'plugins', 'development-kit', 'plugin.json');
  const targetPluginJson = join(pluginDir, 'plugin.json');

  if (existsSync(sourcePluginJson)) {
    try {
      const raw = readFileSync(sourcePluginJson, 'utf-8');
      const manifest = JSON.parse(raw);
      if (manifest.version !== packageMetadata.version) {
        throw new Error(
          `Source plugin manifest version ${manifest.version ?? 'missing'} does not match package version ${packageMetadata.version}`,
        );
      }
      if (Array.isArray(manifest.skills)) {
        manifest.skills = manifest.skills.map((s) => s.replace(/^\.\.\/\.\.\/\.\.\//, './'));
      }
      if (Array.isArray(manifest.agents)) {
        manifest.agents = manifest.agents.map((a) => a.replace(/^\.\.\/\.\.\/\.\.\//, './'));
      }
      if (Array.isArray(manifest.hooks)) {
        manifest.hooks = manifest.hooks.map((h) => h.replace(/^\.\.\/\.\.\/\.\.\//, './'));
      }
      writeFileSync(targetPluginJson, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log('  ✓ plugin.json installed and relative paths rewritten');
    } catch (err) {
      console.error(`  ✗ Failed plugin manifest integrity/rewrite: ${err.message}`);
      throw err;
    }
  }

  const sourceAgentsMd = join(ROOT, 'AGENTS.md');
  const targetAgentsMd = join(targetDir, 'AGENTS.md');

  if (existsSync(sourceAgentsMd)) {
    const targetAgentsMdExists = existsSync(targetAgentsMd);
    if (targetAgentsMdExists && !force) {
      console.log('  - AGENTS.md already exists at target (skipped)');
    } else {
      copyFileSync(sourceAgentsMd, targetAgentsMd);
      const label = targetAgentsMdExists ? ' (overwrite)' : '';
      console.log(`  ✓ AGENTS.md installed${label}`);
    }
  }

  // Rewrite command markdown files inside pluginDir so commands execute via run.mjs
  const pluginCommandsDir = join(pluginDir, 'commands');
  if (existsSync(pluginCommandsDir)) {
    const cmdFiles = readdirSync(pluginCommandsDir).filter((f) => f.endsWith('.md'));
    const runnerTarget = mode === 'global'
      ? `"${join(pluginDir, 'scripts', 'run.mjs')}"`
      : '.agents/plugins/development-kit/scripts/run.mjs';

    for (const f of cmdFiles) {
      const p = join(pluginCommandsDir, f);
      let content = readFileSync(p, 'utf8');
      content = content.replace(/node\s+scripts\/([a-zA-Z0-9_-]+\.mjs)/g, `node ${runnerTarget} $1`);
      writeFileSync(p, content, 'utf8');
    }
    console.log(`  ✓ plugin commands rewritten for ${mode} execution via ${runnerTarget}`);
  }

  verifyPluginInstallation(pluginDir, packageMetadata.version);

  console.log('\nInstallation complete.');
  console.log('\nAvailable commands:');
  printCommands();
}

function installOpencode(dryRun = false, force = false) {
  const targetDir = process.cwd();
  const skillsTarget = join(targetDir, '.opencode', 'skills');
  const label = dryRun ? 'Would install' : 'Installing';

  console.log(`${label} Development Kit for OpenCode at: ${targetDir}\n`);

  const skillsSource = join(ROOT, 'skills');
  if (existsSync(skillsSource)) {
    if (!dryRun) mkdirSync(skillsTarget, { recursive: true });
    for (const skillDir of readdirSync(skillsSource)) {
      const src = join(skillsSource, skillDir);
      const dst = join(skillsTarget, skillDir);
      if (statSync(src).isDirectory()) {
        const targetSkillExists = existsSync(dst);
        if (targetSkillExists && !force) {
          console.log(`  ${dryRun ? '→' : '-'} ${skillDir} already exists (skipped)`);
        } else {
          if (!dryRun) cpSync(src, dst, { recursive: true });
          const mark = targetSkillExists ? ' (overwrite)' : '';
          console.log(`  ${dryRun ? '→' : '✓'} skills/${skillDir} installed${mark}`);
        }
      }
    }
  }

  const opencodeJsonSource = join(ROOT, 'opencode.json');
  const opencodeJsonTarget = join(targetDir, 'opencode.json');
  if (existsSync(opencodeJsonSource)) {
    const targetExists = existsSync(opencodeJsonTarget);
    if (targetExists && !force) {
      console.log(`  ${dryRun ? '→' : '-'} opencode.json already exists (skipped)`);
    } else {
      if (!dryRun) copyFileSync(opencodeJsonSource, opencodeJsonTarget);
      const mark = targetExists ? ' (overwrite)' : '';
      console.log(`  ${dryRun ? '→' : '✓'} opencode.json installed${mark}`);
    }
  }

  const agentsMdSource = join(ROOT, 'AGENTS.md');
  const agentsMdTarget = join(targetDir, 'AGENTS.md');
  if (existsSync(agentsMdSource)) {
    const targetExists = existsSync(agentsMdTarget);
    if (targetExists && !force) {
      console.log(`  ${dryRun ? '→' : '-'} AGENTS.md already exists at project root (skipped)`);
    } else {
      if (!dryRun) copyFileSync(agentsMdSource, agentsMdTarget);
      const mark = targetExists ? ' (overwrite)' : '';
      console.log(`  ${dryRun ? '→' : '✓'} AGENTS.md installed${mark}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run complete. No files were copied. Run without --dry-run to install.');
  } else {
    console.log('\nInstallation complete. Skills are available at .opencode/skills/');
  }
  console.log('\nAvailable commands:');
  printCommands();
}

function installAll(dryRun = false, force = false) {
  const targetDir = process.cwd();
  const label = dryRun ? 'Would install' : 'Installing';

  console.log(`${label} Development Kit to: ${targetDir}\n`);

  const dirs = ['agents', 'skills', 'commands', 'hooks', 'templates', 'evals', 'runtime', 'schemas', 'scripts'];
  const files = ['AGENTS.md', 'README.md'];

  for (const dir of dirs) {
    const source = join(ROOT, dir);
    const target = join(targetDir, dir);
    if (existsSync(source)) {
      const count = readdirSync(source).length;
      const exists = existsSync(target) ? ' (overwrite)' : '';
      if (!dryRun) cpSync(source, target, { recursive: true });
      console.log(`  ${dryRun ? '→' : '✓'} ${dir}/  (${count} files)${exists}`);
    }
  }

  for (const file of files) {
    const source = join(ROOT, file);
    const target = join(targetDir, file);
    if (existsSync(source) && statSync(source).isFile()) {
      const targetExists = existsSync(target);
      if (targetExists && !force) {
        console.log(`  ${dryRun ? '→' : '-'} ${file} already exists (skipped)`);
      } else {
        if (!dryRun) copyFileSync(source, target);
        const exists = targetExists ? ' (overwrite)' : '';
        console.log(`  ${dryRun ? '→' : '✓'} ${file} installed${exists}`);
      }
    }
  }

  const pluginSource = join(ROOT, '.agents', 'plugins', 'development-kit');
  const pluginTarget = join(targetDir, '.agents', 'plugins', 'development-kit');
  if (existsSync(pluginSource)) {
    const exists = existsSync(pluginTarget) ? ' (overwrite)' : '';
    if (!dryRun) {
      mkdirSync(pluginTarget, { recursive: true });
      cpSync(pluginSource, pluginTarget, { recursive: true });
    }
    console.log(`  ${dryRun ? '→' : '✓'} .agents/plugins/development-kit/${exists}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. No files were copied. Run without --dry-run to install.');
  } else {
    console.log('\nInstallation complete. All Development Kit files are available at project root.');
  }
  console.log('\nAvailable commands:');
  printCommands();
}

function main() {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === 'init' ? rawArgs.slice(1) : rawArgs;

  const unsupported = args.find((arg) => !arg.startsWith('--') || !KNOWN_FLAGS.has(arg));
  if (unsupported) {
    console.error(`Unknown or unsupported argument: ${unsupported}`);
    process.exit(1);
  }

  if (args.includes('--help')) {
    console.log(HELP);
    process.exit(0);
  }

  const platforms = resolvePlatformSelection(args);
  const selectedPlatformFlags = PLATFORM_FLAGS.filter((flag) => args.includes(flag));
  const selectedLegacyFlags = ['--opencode', '--all', '--global', '--project']
    .filter((flag) => args.includes(flag));

  if (selectedPlatformFlags.length > 0 && selectedLegacyFlags.length > 0) {
    console.error(
      `Platform adapter flags ${selectedPlatformFlags.join(', ')} cannot be combined with legacy target flags ${selectedLegacyFlags.join(', ')}.`,
    );
    process.exit(1);
  }

  if (args.includes('--dry-run') && !args.includes('--all') && !args.includes('--opencode') && platforms.length === 0) {
    console.log('--dry-run must be used with --all, --opencode, or a platform adapter');
    console.log('  node scripts/install-antigravity.mjs --all --dry-run');
    console.log('  node scripts/install-antigravity.mjs --opencode --dry-run');
    console.log('  node scripts/install-antigravity.mjs --all-platforms --dry-run');
    process.exit(1);
  }

  const force = args.includes('--force');

  if (platforms.length > 0) {
    const dryRun = args.includes('--dry-run');
    const results = installPlatformAdapters({
      targetDir: process.cwd(),
      platforms,
      dryRun,
      force,
    });
    const action = dryRun ? 'Would install' : 'Installing';
    console.log(`${action} Development Kit platform adapters: ${platforms.join(', ')}`);
    for (const result of results) console.log(`  ${result.status}: ${result.targetPath}`);
    if (dryRun) console.log('\nDry run complete. No files were copied.');
    process.exit(0);
  }

  if (args.includes('--opencode')) {
    installOpencode(args.includes('--dry-run'), force);
    process.exit(0);
  }

  if (args.includes('--all')) {
    installAll(args.includes('--dry-run'), force);
    process.exit(0);
  }

  if (args.includes('--global')) {
    const globalDir = join(process.env.HOME || process.env.USERPROFILE || '~', '.gemini', 'config');
    if (!existsSync(globalDir)) mkdirSync(globalDir, { recursive: true });
    installPlugin(globalDir, force, 'global');
    process.exit(0);
  }

  if (args.includes('--project')) {
    const projectDir = join(process.cwd(), '.agents');
    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });
    installPlugin(projectDir, force, 'project');
    process.exit(0);
  }

  const antigravityPath = detectAntigravity();
  if (antigravityPath) {
    const mode = antigravityPath.includes('.gemini') ? 'global' : 'project';
    installPlugin(antigravityPath, force, mode);
  } else {
    console.log('Antigravity configuration not found.');
    console.log('To install globally:      node scripts/install-antigravity.mjs --global');
    console.log('To install locally:       node scripts/install-antigravity.mjs --project');
    console.log('To install standalone:    node scripts/install-antigravity.mjs --all');
    console.log('To install for OpenCode:  node scripts/install-antigravity.mjs --opencode');
    console.log('To install platform rules: node scripts/install-antigravity.mjs [--claude|--cursor|--vscode|--cline|--windsurf|--all-platforms]');
    process.exit(1);
  }
}

main();
