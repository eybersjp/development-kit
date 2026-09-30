/**
 * Development Kit — Secrets & Configuration Readiness Gate
 *
 * Implements a non-bypassable runtime control-plane gate that detects when project development
 * depends on configuration requiring Product Owner action:
 * - API keys, secrets, tokens, database credentials
 * - public environment configuration, project/tenant/app identifiers
 * - OAuth configuration, webhook secrets, external service configuration
 * - generated application secrets, manually completed provider configuration
 *
 * Core invariant:
 * "DKF may know that a secret is present and valid without the AI model knowing its value."
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { persistPODecision, createPODecision } from './po-decisions.mjs';
import { validateDevelopmentContract } from './development-contract.mjs';

export const CONFIGURATION_READINESS_SCHEMA_VERSION = '1.0.0';

export const CONFIGURATION_KINDS = Object.freeze([
  'secret',
  'public_config',
  'identifier',
  'generated_secret',
  'manual_setup',
]);
export const REQUIREMENT_KINDS = CONFIGURATION_KINDS;

export const REQUIREMENT_STATUSES = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  MISSING: 'MISSING',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  CONFIGURED: 'CONFIGURED',
  VALIDATING: 'VALIDATING',
  VALID: 'VALID',
  INVALID: 'INVALID',
  DEFERRED_BY_PRODUCT_OWNER: 'DEFERRED_BY_PRODUCT_OWNER',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});
export const REQUIREMENT_STATES = Object.freeze(Object.values(REQUIREMENT_STATUSES));

export const GATE_STATES = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  CLEARED_WITH_DEFERRED_REQUIREMENTS: 'CLEARED_WITH_DEFERRED_REQUIREMENTS',
});

export const REQUIRED_BY_STAGES = Object.freeze([
  'implementation',
  'runtime-verification',
  'release',
]);

export const COMMON_PLACEHOLDERS = Object.freeze([
  'your_api_key',
  'your-api-key',
  'insert-key-here',
  'insert_key_here',
  'changeme',
  'change_me',
  'todo',
  'example',
  'placeholder',
  'xxxxx',
  '<api_key>',
  '<secret>',
  'your_key_here',
  'your-key-here',
  'your_secret_here',
  'your-secret-here',
  'my_api_key',
  'my-api-key',
]);

export class ConfigurationReadinessError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ConfigurationReadinessError';
    this.details = details;
  }
}

/**
 * Redacts known sensitive values from any string or payload.
 */
export function redactSensitiveValue(text, sensitiveValues = []) {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const val of sensitiveValues) {
    if (typeof val === 'string' && val.length > 3) {
      result = result.split(val).join('[REDACTED]');
    }
  }
  return result;
}

/**
 * Checks whether a given string value represents a placeholder rather than real configuration.
 */
export function isPlaceholderValue(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (COMMON_PLACEHOLDERS.includes(lower)) return true;

  // Patterns like <ANYTHING>, YOUR_..., INSERT_..., TODO_..., etc.
  if (/^<.*>$/.test(trimmed)) return true;
  if (/^(your[-_]|insert[-_]|todo[-_]|change[-_]me|placeholder)/i.test(trimmed)) return true;
  if (/^(xxx+|yyy+|zzz+)$/i.test(trimmed)) return true;

  return false;
}

/**
 * Safe git command runner without shell execution.
 */
function runGit(args, cwd, gitBinary = 'git') {
  try {
    const res = spawnSync(gitBinary, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
    });
    return {
      success: res.status === 0,
      status: res.status,
      stdout: res.stdout ? res.stdout.trim() : '',
      stderr: res.stderr ? res.stderr.trim() : '',
    };
  } catch (err) {
    return {
      success: false,
      status: -1,
      stdout: '',
      stderr: err.message,
    };
  }
}

/**
 * Asserts whether a secret target file is safe from source-control exposure.
 *
 * Rules:
 * 1. Determine whether the path is ignored.
 * 2. Determine whether it is already tracked by Git.
 * 3. Add the appropriate ignore rule when safe and necessary.
 * 4. If already tracked, STOP and fail closed.
 */
export function assertSecretTargetSafe(rootDir = process.cwd(), targetFile = '.env.local', { gitBinary = 'git' } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const relativeTarget = path.relative(resolvedRoot, path.resolve(resolvedRoot, targetFile)).replace(/\\/g, '/');

  // If outside root
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    return {
      safe: false,
      tracked: false,
      ignored: false,
      code: 'TARGET_ESCAPES_ROOT',
      reason: `Target file ${targetFile} escapes project root`,
    };
  }

  // Check if Git is available
  const gitCheck = runGit(['rev-parse', '--is-inside-work-tree'], resolvedRoot, gitBinary);
  if (!gitCheck.success) {
    // Not in a git repo - ensure local .gitignore contains the rule if .gitignore exists or create it
    const gitignorePath = path.join(resolvedRoot, '.gitignore');
    const ruleToAdd = relativeTarget.startsWith('.env') ? relativeTarget : `/${relativeTarget}`;
    let isPresent = false;
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
      isPresent = content.split(/\r?\n/).some((line) => line.trim() === targetFile || line.trim() === relativeTarget);
    }
    if (!isPresent) {
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
      content += `${ruleToAdd}\n`;
      fs.writeFileSync(gitignorePath, content, 'utf8');
    }
    return {
      safe: true,
      tracked: false,
      ignored: true,
      gitAvailable: false,
    };
  }

  // 1. Check if file is tracked by Git
  const lsFiles = runGit(['ls-files', '--error-unmatch', relativeTarget], resolvedRoot, gitBinary);
  if (lsFiles.success) {
    return {
      safe: false,
      tracked: true,
      ignored: false,
      code: 'TARGET_TRACKED_BY_GIT',
      reason: `SECURITY BLOCKER: ${targetFile} is currently tracked by Git. Do not enter credentials yet. The file must first be removed from source tracking.`,
    };
  }

  // 2. Check if file is ignored by Git
  const checkIgnore = runGit(['check-ignore', '-q', relativeTarget], resolvedRoot, gitBinary);
  let isIgnored = checkIgnore.success;

  if (!isIgnored) {
    // Add ignore rule safely to .gitignore
    const gitignorePath = path.join(resolvedRoot, '.gitignore');
    const ruleToAdd = relativeTarget.startsWith('.env') ? relativeTarget : `/${relativeTarget}`;
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `${ruleToAdd}\n`;
    fs.writeFileSync(gitignorePath, content, 'utf8');

    // Recheck ignore
    const recheck = runGit(['check-ignore', '-q', relativeTarget], resolvedRoot, gitBinary);
    isIgnored = recheck.success;
  }

  return {
    safe: true,
    tracked: false,
    ignored: isIgnored,
  };
}

/**
 * Resolves the appropriate configuration target file using priority:
 * 1. existing project convention
 * 2. documented project configuration
 * 3. existing example/template
 * 4. known framework convention
 * 5. unresolved (TARGET_LOCATION_UNRESOLVED)
 */
export function resolveTargetLocation(rootDir = process.cwd(), reqName = '') {
  const resolvedRoot = path.resolve(rootDir);

  // 1. Existing local env files that already exist
  const candidateFiles = [
    '.env.local',
    '.env.development.local',
    '.env',
  ];

  for (const file of candidateFiles) {
    const fullPath = path.join(resolvedRoot, file);
    if (fs.existsSync(fullPath)) {
      return {
        type: 'environment-variable',
        file,
        variable: reqName,
        resolved: true,
      };
    }
  }

  // 2. Check templates/examples
  const templateFiles = [
    '.env.example',
    '.env.template',
    '.env.sample',
    'example.env',
  ];
  for (const tpl of templateFiles) {
    if (fs.existsSync(path.join(resolvedRoot, tpl))) {
      // If template exists, framework convention or .env / .env.local
      // Check package.json for Next/Vite
      const pkgPath = path.join(resolvedRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.dependencies?.next || pkg.devDependencies?.next) {
            return { type: 'environment-variable', file: '.env.local', variable: reqName, resolved: true };
          }
          if (pkg.dependencies?.vite || pkg.devDependencies?.vite) {
            return { type: 'environment-variable', file: '.env.local', variable: reqName, resolved: true };
          }
        } catch {}
      }
      return { type: 'environment-variable', file: '.env', variable: reqName, resolved: true };
    }
  }

  // 3. Known framework conventions from package.json
  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies?.next || pkg.devDependencies?.next || pkg.dependencies?.vite || pkg.devDependencies?.vite) {
        return { type: 'environment-variable', file: '.env.local', variable: reqName, resolved: true };
      }
      // Node standard
      return { type: 'environment-variable', file: '.env', variable: reqName, resolved: true };
    } catch {}
  }

  // Python project
  if (
    fs.existsSync(path.join(resolvedRoot, 'requirements.txt')) ||
    fs.existsSync(path.join(resolvedRoot, 'pyproject.toml'))
  ) {
    return { type: 'environment-variable', file: '.env', variable: reqName, resolved: true };
  }

  // If completely indeterminate:
  return {
    type: 'environment-variable',
    file: null,
    variable: reqName,
    resolved: false,
    unresolvedReason: 'TARGET_LOCATION_UNRESOLVED',
  };
}

/**
 * Computes exact 1-based line number for a variable in an environment file.
 */
export function computeVariableLine(rootDir = process.cwd(), fileName = '.env.local', variableName = '') {
  if (!fileName || !variableName) return null;
  const filePath = path.resolve(rootDir, fileName);
  if (!fs.existsSync(filePath)) return null;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const regex = new RegExp(`^\\s*${variableName}\\s*=`);
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return i + 1; // 1-based
    }
  }
  return null;
}

/**
 * Safely prepares environment file without fake secrets or overwriting existing values.
 */
export function prepareConfigurationTargets(rootDir = process.cwd(), requirements = []) {
  const resolvedRoot = path.resolve(rootDir);
  const preparedFiles = new Set();
  const results = [];

  for (const req of requirements) {
    if (req.kind === 'manual_setup') continue;
    const target = req.target;
    if (!target || target.type !== 'environment-variable' || !target.file || !target.variable) {
      continue;
    }

    const filePath = path.resolve(resolvedRoot, target.file);
    let content = '';
    let exists = false;
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
      exists = true;
    }

    const lines = exists ? content.split(/\r?\n/) : [];
    const varRegex = new RegExp(`^\\s*${target.variable}\\s*=`);
    const alreadyPresent = lines.some((l) => varRegex.test(l));

    if (!alreadyPresent) {
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `\n# Required — see .development-kit/SECRETS_SETUP.md\n${target.variable}=\n`;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      preparedFiles.add(target.file);
    }

    // Ensure secret-bearing target is safe and added to .gitignore
    if (req.kind === 'secret' || req.kind === 'generated_secret') {
      assertSecretTargetSafe(resolvedRoot, target.file);
    }

    // Recompute line number
    target.line = computeVariableLine(resolvedRoot, target.file, target.variable);
    results.push({
      requirementId: req.id,
      file: target.file,
      variable: target.variable,
      line: target.line,
    });
  }

  return {
    preparedFiles: [...preparedFiles],
    targets: results,
  };
}

/**
 * Reads local environment variable value deterministically without exposing it to the AI model.
 */
export function readLocalTargetValue(rootDir = process.cwd(), target = {}) {
  if (!target || target.type !== 'environment-variable' || !target.file || !target.variable) {
    return null;
  }
  const filePath = path.resolve(rootDir, target.file);
  if (!fs.existsSync(filePath)) {
    // Also check process.env as fallback
    if (process.env[target.variable] !== undefined) {
      return process.env[target.variable];
    }
    return null;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const regex = new RegExp(`^\\s*${target.variable}\\s*=\\s*(.*)$`);
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      let raw = match[1].trim();
      // Handle quotes
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
      }
      return raw;
    }
  }

  if (process.env[target.variable] !== undefined) {
    return process.env[target.variable];
  }
  return null;
}

/**
 * Validates an individual configuration requirement deterministically.
 * NEVER returns the secret value.
 */
export function validateConfigurationRequirement(rootDir = process.cwd(), req, { forceManualCheck = false } = {}) {
  if (!req || typeof req !== 'object') {
    throw new ConfigurationReadinessError('Requirement is required');
  }

  if (req.status === REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER) {
    return {
      status: REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER,
      valid: false,
      reason: 'Deferred by Product Owner',
    };
  }

  if (req.kind === 'manual_setup') {
    if (req.status === REQUIREMENT_STATUSES.VALID) {
      return { status: REQUIREMENT_STATUSES.VALID, valid: true };
    }
    return {
      status: req.status || REQUIREMENT_STATUSES.WAITING_FOR_USER,
      valid: req.status === REQUIREMENT_STATUSES.VALID,
      reason: 'Manual provider configuration requires user verification',
    };
  }

  if (!req.target || !req.target.file) {
    return {
      status: REQUIREMENT_STATUSES.INVALID,
      valid: false,
      reason: 'Target location unresolved',
    };
  }

  // Check git security if secret
  if (req.kind === 'secret' || req.kind === 'generated_secret') {
    const safety = assertSecretTargetSafe(rootDir, req.target.file);
    if (!safety.safe && safety.tracked) {
      return {
        status: REQUIREMENT_STATUSES.INVALID,
        valid: false,
        reason: safety.reason,
        securityBlock: true,
      };
    }
  }

  const value = readLocalTargetValue(rootDir, req.target);
  if (value === null || value === undefined || value.trim() === '') {
    return {
      status: REQUIREMENT_STATUSES.MISSING,
      valid: false,
      reason: 'Value is empty or not set',
    };
  }

  if (isPlaceholderValue(value)) {
    return {
      status: REQUIREMENT_STATUSES.MISSING,
      valid: false,
      reason: 'Value is a placeholder',
    };
  }

  // Presence passes
  const level = req.validationLevel || 'presence';
  if (level === 'structure' || req.expectedFormat) {
    if (req.expectedFormat === 'url') {
      try {
        new URL(value);
      } catch {
        return {
          status: REQUIREMENT_STATUSES.INVALID,
          valid: false,
          reason: 'Expected valid URL format',
        };
      }
    } else if (req.expectedFormat === 'uuid') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return {
          status: REQUIREMENT_STATUSES.INVALID,
          valid: false,
          reason: 'Expected UUID format',
        };
      }
    } else if (req.expectedFormat === 'prefix' && req.description?.includes('prefix:')) {
      const expectedPrefix = req.description.split('prefix:')[1].trim().split(' ')[0];
      if (!value.startsWith(expectedPrefix)) {
        return {
          status: REQUIREMENT_STATUSES.INVALID,
          valid: false,
          reason: `Expected prefix ${expectedPrefix}`,
        };
      }
    }
  }

  return {
    status: REQUIREMENT_STATUSES.VALID,
    valid: true,
  };
}

/**
 * Generates secure local generated secret and updates target file.
 */
export function generateLocalSecret(rootDir = process.cwd(), req, { byteLength = 32, encoding = 'hex' } = {}) {
  if (req.kind !== 'generated_secret') {
    throw new ConfigurationReadinessError(`Cannot generate secret for kind: ${req.kind}`);
  }
  const secretValue = crypto.randomBytes(byteLength).toString(encoding);
  const target = req.target;
  if (!target || !target.file || !target.variable) {
    throw new ConfigurationReadinessError('Target file and variable must be resolved to store generated secret');
  }

  const filePath = path.resolve(rootDir, target.file);
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = content.split(/\r?\n/);
  const regex = new RegExp(`^\\s*${target.variable}\\s*=`);
  let replaced = false;

  const newLines = lines.map((line) => {
    if (regex.test(line)) {
      replaced = true;
      return `${target.variable}=${secretValue}`;
    }
    return line;
  });

  if (!replaced) {
    if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
      newLines.push('');
    }
    newLines.push(`# Generated application secret`);
    newLines.push(`${target.variable}=${secretValue}`);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${newLines.join('\n')}\n`, 'utf8');

  req.status = REQUIREMENT_STATUSES.VALID;
  req.target.line = computeVariableLine(rootDir, target.file, target.variable);
  return {
    success: true,
    storedIn: target.file,
    line: req.target.line,
  };
}

/**
 * Scans code files for environment references.
 */
function scanCodeForEnvReferences(rootDir) {
  const discovered = [];
  const searchDirs = ['src', 'lib', 'app', 'routes', 'api', 'server', 'client'];
  const extRegex = /\.(js|jsx|ts|tsx|mjs|cjs|py)$/;

  const patterns = [
    { regex: /process\.env\.([A-Z0-9_]{3,64})/g, source: 'process.env' },
    { regex: /process\.env\[['"]([A-Z0-9_]{3,64})['"]\]/g, source: 'process.env' },
    { regex: /import\.meta\.env\.([A-Z0-9_]{3,64})/g, source: 'import.meta.env' },
    { regex: /Deno\.env\.get\(['"]([A-Z0-9_]{3,64})['"]\)/g, source: 'Deno.env' },
    { regex: /Bun\.env\.([A-Z0-9_]{3,64})/g, source: 'Bun.env' },
    { regex: /os\.environ(?:\[['"]|\.get\(['"])([A-Z0-9_]{3,64})['"]/g, source: 'os.environ' },
    { regex: /os\.getenv\(['"]([A-Z0-9_]{3,64})['"]\)/g, source: 'os.getenv' },
    { regex: /getenv\(['"]([A-Z0-9_]{3,64})['"]\)/g, source: 'getenv' },
  ];

  function crawl(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', '.development-kit', 'dist', 'build', '.next'].includes(entry.name)) {
          crawl(full);
        }
      } else if (entry.isFile() && extRegex.test(entry.name)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          for (const { regex, source } of patterns) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(content)) !== null) {
              const name = match[1];
              // Avoid common false positives
              if (!['NODE_ENV', 'PORT', 'HOST', 'PATH', 'HOME', 'USER'].includes(name)) {
                discovered.push({
                  name,
                  source: 'repository-reference',
                  path: path.relative(rootDir, full).replace(/\\/g, '/'),
                  detail: source,
                });
              }
            }
          }
        } catch {}
      }
    }
  }

  for (const d of searchDirs) {
    crawl(path.join(rootDir, d));
  }

  return discovered;
}

/**
 * Scans .env.example or template files.
 */
function scanEnvTemplates(rootDir) {
  const discovered = [];
  const templates = ['.env.example', '.env.template', '.env.sample', 'example.env'];
  for (const tpl of templates) {
    const full = path.join(rootDir, tpl);
    if (fs.existsSync(full)) {
      try {
        const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([A-Za-z0-9_]{3,64})\s*=/);
          if (match) {
            const name = match[1];
            if (!['NODE_ENV', 'PORT', 'HOST'].includes(name)) {
              discovered.push({
                name,
                source: 'configuration-template',
                path: tpl,
              });
            }
          }
        }
      } catch {}
    }
  }
  return discovered;
}

/**
 * Discovers configuration requirements from all available deterministic sources:
 * - Development Contract (v1.1 or legacy)
 * - Task PLAN
 * - Environment templates (.env.example)
 * - Code references (process.env, import.meta.env, os.environ)
 */
export function discoverConfigurationRequirements({
  rootDir = process.cwd(),
  contract = null,
  task = null,
  plan = null,
  existingRequirements = [],
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const byName = new Map();

  // Seed with existing requirements to preserve stable IDs & states
  for (const req of existingRequirements) {
    byName.set(req.name, structuredClone(req));
  }

  let nextIdNum = 1;
  const existingIds = new Set(existingRequirements.map((r) => r.id));
  const getNextId = () => {
    while (existingIds.has(`CFG-${String(nextIdNum).padStart(3, '0')}`)) {
      nextIdNum++;
    }
    const id = `CFG-${String(nextIdNum).padStart(3, '0')}`;
    existingIds.add(id);
    return id;
  };

  function inferKindAndProvider(name) {
    const upper = name.toUpperCase();
    let kind = 'secret';
    let provider = 'Project / Runtime';

    if (upper.includes('NEXT_PUBLIC_') || upper.includes('VITE_') || upper.includes('PUBLIC_')) {
      kind = 'public_config';
    } else if (upper.includes('_ID') || upper.includes('APP_ID') || upper.includes('PROJECT_ID')) {
      kind = 'identifier';
    } else if (upper.includes('SESSION_SECRET') || upper.includes('JWT_SECRET') || upper.includes('ENCRYPTION_KEY')) {
      kind = 'generated_secret';
    }

    if (upper.includes('SUPABASE')) provider = 'Supabase';
    else if (upper.includes('OPENAI')) provider = 'OpenAI';
    else if (upper.includes('STRIPE')) provider = 'Stripe';
    else if (upper.includes('FIREBASE')) provider = 'Firebase';
    else if (upper.includes('RESEND')) provider = 'Resend';
    else if (upper.includes('GOOGLE')) provider = 'Google Cloud';
    else if (upper.includes('AWS')) provider = 'AWS';
    else if (upper.includes('GITHUB')) provider = 'GitHub';

    return { kind, provider };
  }

  // 1. Contract declared dependencies
  if (contract?.configurationDependencies && Array.isArray(contract.configurationDependencies)) {
    for (const dep of contract.configurationDependencies) {
      if (!dep.name) continue;
      const targetLoc = resolveTargetLocation(resolvedRoot, dep.name);
      if (!byName.has(dep.name)) {
        const inferred = inferKindAndProvider(dep.name);
        byName.set(dep.name, {
          id: dep.id || getNextId(),
          name: dep.name,
          kind: dep.kind || inferred.kind,
          provider: dep.provider || inferred.provider,
          required: dep.required !== false,
          requiredBy: dep.requiredBy || 'runtime-verification',
          requiredByTasks: contract.taskId ? [contract.taskId] : [],
          requiredByCriteria: [],
          status: REQUIREMENT_STATUSES.MISSING,
          target: targetLoc,
          discovery: {
            source: 'development-contract',
            path: contract.contractId,
          },
        });
      }
    }
  }

  // 2. Task or Plan declared dependencies
  const tasksToScan = [];
  if (task) tasksToScan.push(task);
  if (plan?.tasks && Array.isArray(plan.tasks)) tasksToScan.push(...plan.tasks);

  for (const t of tasksToScan) {
    if (t.configurationDependencies && Array.isArray(t.configurationDependencies)) {
      for (const dep of t.configurationDependencies) {
        const name = typeof dep === 'string' ? dep : dep.name;
        if (!name) continue;
        const targetLoc = resolveTargetLocation(resolvedRoot, name);
        if (!byName.has(name)) {
          const inferred = inferKindAndProvider(name);
          byName.set(name, {
            id: typeof dep === 'object' && dep.id ? dep.id : getNextId(),
            name,
            kind: typeof dep === 'object' && dep.kind ? dep.kind : inferred.kind,
            provider: typeof dep === 'object' && dep.provider ? dep.provider : inferred.provider,
            required: true,
            requiredBy: typeof dep === 'object' && dep.requiredBy ? dep.requiredBy : 'runtime-verification',
            requiredByTasks: t.id ? [t.id] : [],
            requiredByCriteria: t.acceptanceCriteria || [],
            status: REQUIREMENT_STATUSES.MISSING,
            target: targetLoc,
            discovery: {
              source: 'task-plan',
              path: t.id,
            },
          });
        } else {
          const existing = byName.get(name);
          if (t.id && !existing.requiredByTasks.includes(t.id)) {
            existing.requiredByTasks.push(t.id);
          }
        }
      }
    }
  }

  // 3. Env Templates
  const templateEntries = scanEnvTemplates(resolvedRoot);
  for (const entry of templateEntries) {
    if (!byName.has(entry.name)) {
      const inferred = inferKindAndProvider(entry.name);
      const targetLoc = resolveTargetLocation(resolvedRoot, entry.name);
      byName.set(entry.name, {
        id: getNextId(),
        name: entry.name,
        kind: inferred.kind,
        provider: inferred.provider,
        required: true,
        requiredBy: 'runtime-verification',
        requiredByTasks: contract?.taskId ? [contract.taskId] : [],
        requiredByCriteria: [],
        status: REQUIREMENT_STATUSES.MISSING,
        target: targetLoc,
        discovery: {
          source: 'configuration-template',
          path: entry.path,
        },
      });
    }
  }

  // 4. Code References
  const codeRefs = scanCodeForEnvReferences(resolvedRoot);
  for (const ref of codeRefs) {
    if (!byName.has(ref.name)) {
      const inferred = inferKindAndProvider(ref.name);
      const targetLoc = resolveTargetLocation(resolvedRoot, ref.name);
      byName.set(ref.name, {
        id: getNextId(),
        name: ref.name,
        kind: inferred.kind,
        provider: inferred.provider,
        required: true,
        requiredBy: 'runtime-verification',
        requiredByTasks: contract?.taskId ? [contract.taskId] : [],
        requiredByCriteria: [],
        status: REQUIREMENT_STATUSES.MISSING,
        target: targetLoc,
        discovery: {
          source: 'repository-reference',
          path: ref.path,
          detail: ref.detail,
        },
      });
    }
  }

  // Link criteria from contract if criterion specifies requirementId or mentions variable
  if (contract?.acceptanceCriteria && Array.isArray(contract.acceptanceCriteria)) {
    for (const c of contract.acceptanceCriteria) {
      if (c.requirementId) {
        for (const req of byName.values()) {
          if (req.id === c.requirementId || req.name === c.requirementId) {
            if (!req.requiredByCriteria.includes(c.id)) {
              req.requiredByCriteria.push(c.id);
            }
          }
        }
      }
    }
  }

  // Evaluate validity of each requirement
  const list = [...byName.values()];
  for (const req of list) {
    if (req.status !== REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER) {
      const val = validateConfigurationRequirement(resolvedRoot, req);
      req.status = val.status;
    }
    if (req.target && req.target.file) {
      req.target.line = computeVariableLine(resolvedRoot, req.target.file, req.target.variable);
    }
  }

  return list;
}

/**
 * Storage paths
 */
export function getSecretsDirectory(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'secrets');
}

export function getRequirementsRegistryPath(rootDir = process.cwd()) {
  return path.join(getSecretsDirectory(rootDir), 'requirements.json');
}

export function getGateStatePath(rootDir = process.cwd()) {
  return path.join(getSecretsDirectory(rootDir), 'gate-state.json');
}

export function getSetupGuidePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'SECRETS_SETUP.md');
}

/**
 * Loads configuration registry.
 */
export function loadConfigurationRegistry(rootDir = process.cwd()) {
  const regPath = getRequirementsRegistryPath(rootDir);
  if (!fs.existsSync(regPath)) {
    return {
      schemaVersion: CONFIGURATION_READINESS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      requirements: [],
    };
  }
  try {
    const data = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    return data;
  } catch (err) {
    throw new ConfigurationReadinessError(`Failed to load configuration registry: ${err.message}`);
  }
}

/**
 * Saves configuration registry. Never writes secret values!
 */
export function saveConfigurationRegistry(arg1, arg2) {
  // Support both (rootDir, registry) and (registry, rootDir)
  let rootDir = process.cwd();
  let registry = null;
  if (typeof arg1 === 'string') {
    rootDir = arg1;
    registry = arg2;
  } else if (arg1 && typeof arg1 === 'object') {
    registry = arg1;
    if (typeof arg2 === 'string') rootDir = arg2;
  }
  if (!registry) {
    throw new ConfigurationReadinessError('Configuration registry object is required');
  }

  // Security check: ensure no requirement contains a plaintext value
  if (Array.isArray(registry.requirements)) {
    for (const req of registry.requirements) {
      if (req.value !== undefined || req.rawValue !== undefined || req.secretValue !== undefined) {
        throw new ConfigurationReadinessError(`Security violation: requirement ${req.id || req.name} must not contain plaintext value in registry`);
      }
    }
  }

  const dir = getSecretsDirectory(rootDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    schemaVersion: registry.schemaVersion || CONFIGURATION_READINESS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    requirements: registry.requirements || [],
  };

  const regPath = getRequirementsRegistryPath(rootDir);
  fs.writeFileSync(regPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return regPath;
}

/**
 * Evaluates the overall Gate State from registered requirements.
 */
export function evaluateConfigurationReadiness({
  rootDir = process.cwd(),
  requirements = [],
  activeContractId = null,
  activeRunId = null,
} = {}) {
  if (requirements.length === 0) {
    return {
      schemaVersion: CONFIGURATION_READINESS_SCHEMA_VERSION,
      gate: 'SECRET_READINESS_GATE',
      state: GATE_STATES.READY,
      activeContractId,
      activeRunId,
      blockingRequirements: [],
      deferredRequirements: [],
      productOwnerActionRequired: false,
      updatedAt: new Date().toISOString(),
      counts: { total: 0, valid: 0, missing: 0, invalid: 0, deferred: 0 },
    };
  }

  const blocking = [];
  const deferred = [];
  let validCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let hasWaiting = false;

  for (const req of requirements) {
    const status = req.status;
    if (status === REQUIREMENT_STATUSES.VALID) {
      validCount++;
    } else if (status === REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER) {
      deferred.push(req.id);
    } else if (status === REQUIREMENT_STATUSES.MISSING) {
      missingCount++;
      blocking.push(req.id);
    } else if (status === REQUIREMENT_STATUSES.INVALID) {
      invalidCount++;
      blocking.push(req.id);
    } else if (status === REQUIREMENT_STATUSES.WAITING_FOR_USER) {
      hasWaiting = true;
      blocking.push(req.id);
    } else {
      blocking.push(req.id);
    }
  }

  let state;
  let poActionRequired = false;

  if (blocking.length > 0) {
    state = hasWaiting || missingCount > 0 ? GATE_STATES.WAITING_FOR_USER : GATE_STATES.BLOCKED;
    poActionRequired = true;
  } else if (deferred.length > 0) {
    state = GATE_STATES.CLEARED_WITH_DEFERRED_REQUIREMENTS;
    poActionRequired = false;
  } else {
    state = GATE_STATES.READY;
    poActionRequired = false;
  }

  return {
    schemaVersion: CONFIGURATION_READINESS_SCHEMA_VERSION,
    gate: 'SECRET_READINESS_GATE',
    state,
    activeContractId,
    activeRunId,
    blockingRequirements: blocking,
    deferredRequirements: deferred,
    productOwnerActionRequired: poActionRequired,
    updatedAt: new Date().toISOString(),
    counts: {
      total: requirements.length,
      valid: validCount,
      missing: missingCount,
      invalid: invalidCount,
      deferred: deferred.length,
    },
  };
}

/**
 * Saves Gate State to disk.
 */
export function saveConfigurationGateState(gateState, rootDir = process.cwd()) {
  const dir = getSecretsDirectory(rootDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = getGateStatePath(rootDir);
  fs.writeFileSync(p, `${JSON.stringify(gateState, null, 2)}\n`, 'utf8');
  return p;
}

/**
 * Loads Gate State from disk.
 */
export function loadConfigurationGateState(rootDir = process.cwd()) {
  const p = getGateStatePath(rootDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Generates .development-kit/SECRETS_SETUP.md guide.
 * Contains NO secret values.
 */
export function generateConfigurationSetupGuide(rootDir = process.cwd(), requirements = []) {
  const lines = [
    '# Secrets & Configuration Setup Guide',
    '',
    '> **SECURITY NOTICE**: This file contains setup instructions and metadata only.',
    '> Actual secret values must NEVER be pasted or committed into this document.',
    '> Enter credentials exclusively into your local runtime configuration files (.env.local) or provider consoles.',
    '',
  ];

  if (requirements.length === 0) {
    lines.push('No configuration requirements are currently registered.');
  } else {
    for (const req of requirements) {
      lines.push(`## ${req.id} — ${req.name}`);
      lines.push('');
      lines.push(`- **Provider**: ${req.provider}`);
      lines.push(`- **Kind**: \`${req.kind}\``);
      lines.push(`- **Sensitive**: ${req.kind === 'secret' || req.kind === 'generated_secret' ? 'YES (Secret — do not share)' : 'NO (Public configuration)'}`);
      lines.push(`- **Status**: \`${req.status}\``);
      lines.push(`- **Required By Stage**: \`${req.requiredBy}\``);

      if (req.target) {
        lines.push(`- **Target Location**: \`${req.target.file || req.target.type}\``);
        if (req.target.variable) lines.push(`- **Variable Name**: \`${req.target.variable}\``);
        if (req.target.line) lines.push(`- **Current Insertion Line**: Line ${req.target.line}`);
      }

      lines.push('');
      lines.push(`### Description & Purpose`);
      lines.push(req.description || `Required for ${req.provider} integration.`);
      lines.push('');

      lines.push(`### How to Obtain / Configure`);
      if (req.kind === 'generated_secret') {
        lines.push('This value should be generated locally using secure random bytes and does not need to be retrieved from an external service.');
      } else if (req.kind === 'manual_setup') {
        lines.push(`Log into your ${req.provider} console and perform the required manual configuration.`);
      } else {
        lines.push(`Retrieve this from your ${req.provider} dashboard / developer console under API Keys / Settings.`);
      }
      lines.push('');

      lines.push(`### Affected Tasks & Acceptance Criteria`);
      lines.push(`- Tasks: ${req.requiredByTasks?.length ? req.requiredByTasks.join(', ') : 'None'}`);
      lines.push(`- Criteria: ${req.requiredByCriteria?.length ? req.requiredByCriteria.join(', ') : 'None'}`);
      lines.push('');

      lines.push(`### Consequence of Deferral`);
      lines.push(req.deferConsequence || 'If deferred, dependent features cannot be verified and affected acceptance criteria will remain UNVERIFIED.');
      lines.push('');

      lines.push(`### Verification Method`);
      lines.push(req.verificationMethod || 'Local format and presence validation, plus runtime integration checks.');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  const guidePath = getSetupGuidePath(rootDir);
  fs.mkdirSync(path.dirname(guidePath), { recursive: true });
  fs.writeFileSync(guidePath, lines.join('\n'), 'utf8');
  return guidePath;
}

/**
 * Records a Product Owner configuration decision.
 * Reuses PODecision model for deferral provenance.
 */
export function recordConfigurationDecision({
  rootDir = process.cwd(),
  requirementId,
  decision, // 'defer', 'configure', 'generate', 'cancel'
  confirmed = true,
  contractId = null,
  sourceFingerprint = null,
  authority = 'product-owner',
} = {}) {
  const registry = loadConfigurationRegistry(rootDir);
  const req = registry.requirements.find((r) => r.id === requirementId || r.name === requirementId);
  if (!req) {
    throw new ConfigurationReadinessError(`Requirement not found: ${requirementId}`);
  }

  if (decision === 'defer') {
    if (!confirmed) {
      throw new ConfigurationReadinessError('Deferral requires explicit confirmation');
    }
    req.status = REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER;

    // Persist PODecision
    const pod = createPODecision({
      id: `POD-CFG-${req.id}-${Date.now()}`,
      statement: `Product Owner deferred configuration requirement ${req.id} (${req.name})`,
      status: 'APPROVED',
      affectedRequirements: [req.id],
      affectedAcceptanceCriteria: req.requiredByCriteria || [],
    });
    persistPODecision(pod, rootDir);

    saveConfigurationRegistry(registry, rootDir);
    return {
      success: true,
      decision: 'defer',
      requirement: req,
      podId: pod.id,
    };
  }

  if (decision === 'configure') {
    const valResult = validateConfigurationRequirement(rootDir, req);
    req.status = valResult.status;
    saveConfigurationRegistry(registry, rootDir);
    return {
      success: true,
      decision: 'configure',
      requirement: req,
      validation: valResult,
    };
  }

  if (decision === 'generate') {
    const genResult = generateLocalSecret(rootDir, req);
    saveConfigurationRegistry(registry, rootDir);
    return {
      success: true,
      decision: 'generate',
      requirement: req,
      generation: genResult,
    };
  }

  if (decision === 'cancel') {
    return {
      success: true,
      decision: 'cancel',
      requirement: req,
    };
  }

  throw new ConfigurationReadinessError(`Unsupported decision: ${decision}`);
}
