#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), 'opencode.json');
let config;

try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`OpenCode configuration is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (!config || typeof config !== 'object' || Array.isArray(config)) {
  console.error('OpenCode configuration must be a JSON object.');
  process.exit(1);
}

if (config.$schema !== 'https://opencode.ai/config.json') {
  console.error('OpenCode configuration must declare the current official schema.');
  process.exit(1);
}

if (Object.prototype.hasOwnProperty.call(config, 'rules')) {
  console.error('OpenCode configuration uses the obsolete "rules" key. Use "instructions" or AGENTS.md instead.');
  process.exit(1);
}

if (config.instructions !== undefined) {
  if (!Array.isArray(config.instructions) || config.instructions.some((value) => typeof value !== 'string')) {
    console.error('OpenCode "instructions" must be an array of file paths or URLs.');
    process.exit(1);
  }
}

console.log('OpenCode configuration is valid.');
