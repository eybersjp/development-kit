#!/usr/bin/env node
/**
 * Development Kit Next-Step Guidance — Executable CLI
 *
 * Usage:
 *   node scripts/next-step.mjs --command=/dk-build --stage=IMPLEMENT --success=true
 *   node scripts/next-step.mjs --command=/dk-test --verification=failed
 *   node scripts/next-step.mjs --context-file=context.json
 *   node scripts/next-step.mjs --context-json='{"completedCommand":"/dk-idea","success":true}' --format=json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NextStepResolver,
  formatNextStepGuidance,
  CommandRegistry,
  CANONICAL_LIFECYCLE_STAGES,
  VERIFICATION_STATUSES,
  TESTS_STATUSES,
  REVIEW_STATUSES,
  APPROVAL_STATUSES,
  POST_SIMPLIFICATION_STATUSES,
  validateContextSchema
} from '../runtime/next-step/index.mjs';
import { resolveProjectRoot } from '../runtime/bootstrap/project-root.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts.slice(1).join('=') : (args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true);
      options[key] = value;
    }
  }

  return options;
}

function parseBooleanFlag(name, val) {
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  console.error(`Error: Invalid ${name} value: "${val}" (must be "true" or "false")`);
  process.exit(1);
}

function parseIntegerFlag(name, val, minVal = 0) {
  const num = Number(val);
  if (!Number.isInteger(num) || num < minVal) {
    console.error(`Error: Invalid ${name} value: "${val}" (must be an integer >= ${minVal})`);
    process.exit(1);
  }
  return num;
}

function printHelp() {
  console.log(`
Development Kit Next-Step Guidance CLI

Usage:
  node scripts/next-step.mjs [options]

Options:
  --command=<command>           Completed command (e.g., /dk-build, /dk-idea)
  --previous-command=<command>  Previous command before the completed one
  --stage=<stage>               Current canonical lifecycle stage (UNDERSTAND, DEFINE, DESIGN, PLAN, IMPLEMENT, VERIFY, REVIEW, SIMPLIFY, COMPLETE)
  --success=<true|false>        Whether the command succeeded (default: true)
  --verification=<status>       Verification status: none, passed, failed, partial
  --tests=<status>              Tests status: passed, failed, none
  --review=<status>             Review status: none, clean, issues_found
  --approval=<status>           Approval status: none, pending, approved, rejected
  --post-simplification=<stat>  Post-simplification verification status: not_run, passed, failed
  --approvals=<list>            Comma-separated list of outstanding approval gates
  --blockers=<list>             Comma-separated list of active blocker descriptions
  --remaining-tasks=<num>       Number of remaining implementation tasks
  --complete=<true|false>       Whether the full workflow is complete
  --automated=<true|false>      Whether running in automated guided mode
  --paused=<true|false>         Whether automated execution is currently paused
  --root-dir=<path>             Explicit project root directory
  --context-file=<path>         Path to a JSON file containing full context
  --context-json=<json>         Raw JSON string containing full context
  --format=<markdown|json>      Output format (default: markdown)
  --max=<number>                Maximum number of recommendations (integer >= 1, default: 3)
  --help, -h                    Show this help message
`);
}

function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const explicitRoot = options['root-dir'] || options.rootDir;
  let rootDir;

  try {
    rootDir = resolveProjectRoot({
      cwd: process.cwd(),
      executablePath: __filename,
      explicitRoot,
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const registry = new CommandRegistry({}, rootDir);
  let context = {};

  if (options['context-file']) {
    const filePath = path.resolve(rootDir, String(options['context-file']));
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Context file not found: ${filePath}`);
      process.exit(1);
    }
    try {
      context = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Error parsing context file: ${err.message}`);
      process.exit(1);
    }

    const validation = validateContextSchema(context, registry);
    if (!validation.valid) {
      console.error(`Error in context file: ${validation.error}`);
      process.exit(1);
    }
  } else if (options['context-json']) {
    try {
      context = JSON.parse(String(options['context-json']));
    } catch (err) {
      console.error(`Error parsing context JSON: ${err.message}`);
      process.exit(1);
    }

    const validation = validateContextSchema(context, registry);
    if (!validation.valid) {
      console.error(`Error in context JSON: ${validation.error}`);
      process.exit(1);
    }
  } else {
    // Direct CLI flags validation
    if (options.command) {
      const cmdStr = String(options.command).trim();
      const normCmd = cmdStr.startsWith('/dk-') ? cmdStr : (cmdStr.startsWith('/') ? cmdStr : `/dk-${cmdStr}`);
      if (!registry.has(normCmd)) {
        console.error(`Error: Unknown command: ${options.command}`);
        process.exit(1);
      }
      context.completedCommand = normCmd;
    }

    if (options['previous-command']) {
      const prevStr = String(options['previous-command']).trim();
      const normPrev = prevStr.startsWith('/dk-') ? prevStr : (prevStr.startsWith('/') ? prevStr : `/dk-${prevStr}`);
      if (!registry.has(normPrev)) {
        console.error(`Error: Unknown previous-command: ${options['previous-command']}`);
        process.exit(1);
      }
      context.previousCommand = normPrev;
    }

    if (options.stage) {
      const stageStr = String(options.stage).trim().toUpperCase();
      if (!CANONICAL_LIFECYCLE_STAGES.includes(stageStr)) {
        console.error(`Error: Invalid lifecycle stage: ${options.stage}`);
        process.exit(1);
      }
      context.lifecycleStage = stageStr;
    }

    if (options.success !== undefined) {
      context.success = parseBooleanFlag('--success', options.success);
    }

    if (options.complete !== undefined) {
      context.isWorkflowComplete = parseBooleanFlag('--complete', options.complete);
    }

    if (options.automated !== undefined) {
      context.isAutomated = parseBooleanFlag('--automated', options.automated);
    }

    if (options.paused !== undefined) {
      context.isPaused = parseBooleanFlag('--paused', options.paused);
    }

    if (options.verification) {
      const verStr = String(options.verification).trim().toLowerCase();
      if (!VERIFICATION_STATUSES.includes(verStr)) {
        console.error(`Error: Invalid verification status: ${options.verification}`);
        process.exit(1);
      }
      context.verificationStatus = verStr;
    }

    if (options.tests) {
      const testStr = String(options.tests).trim().toLowerCase();
      if (!TESTS_STATUSES.includes(testStr)) {
        console.error(`Error: Invalid tests status: ${options.tests}`);
        process.exit(1);
      }
      context.testsStatus = testStr;
    }

    if (options.review) {
      const revStr = String(options.review).trim().toLowerCase();
      if (!REVIEW_STATUSES.includes(revStr)) {
        console.error(`Error: Invalid review status: ${options.review}`);
        process.exit(1);
      }
      context.reviewStatus = revStr;
    }

    if (options.approval) {
      const appStr = String(options.approval).trim().toLowerCase();
      if (!APPROVAL_STATUSES.includes(appStr)) {
        console.error(`Error: Invalid approval status: ${options.approval}`);
        process.exit(1);
      }
      context.approvalStatus = appStr;
    }

    const postSimpVal = options['post-simplification'] || options['post-simplification-verification'];
    if (postSimpVal) {
      const postStr = String(postSimpVal).trim().toLowerCase();
      if (!POST_SIMPLIFICATION_STATUSES.includes(postStr)) {
        console.error(`Error: Invalid post-simplification status: ${postSimpVal}`);
        process.exit(1);
      }
      context.postSimplificationVerificationStatus = postStr;
    }

    if (options.approvals) {
      context.outstandingApprovals = typeof options.approvals === 'string'
        ? options.approvals.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    }

    if (options.blockers) {
      context.blockers = typeof options.blockers === 'string'
        ? options.blockers.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    }

    if (options['remaining-tasks'] !== undefined) {
      context.remainingTasks = parseIntegerFlag('--remaining-tasks', options['remaining-tasks'], 0);
    }
  }

  let maxRecs = 3;
  if (options.max !== undefined) {
    maxRecs = parseIntegerFlag('--max', options.max, 1);
  }

  const format = (options.format || 'markdown').toLowerCase();
  if (format !== 'markdown' && format !== 'json') {
    console.error(`Error: Invalid output format: ${options.format}`);
    process.exit(1);
  }

  const resolver = new NextStepResolver({ registry, maxRecommendations: maxRecs });
  const recommendations = resolver.resolve(context, { maxRecommendations: maxRecs });

  if (format === 'json') {
    console.log(JSON.stringify({ recommendations, count: recommendations.length }, null, 2));
  } else {
    const formatted = formatNextStepGuidance(recommendations);
    if (formatted) {
      console.log(formatted);
    }
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule || process.argv[1]?.endsWith('next-step.mjs')) {
  main();
}
