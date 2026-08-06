/**
 * Development Kit Evaluation Suite Validator
 *
 * Validates that all evaluation directories contain valid scenario JSON files.
 */

import fs from 'node:fs';
import path from 'node:path';

const EVALS_DIR = path.resolve(process.cwd(), 'evals');

function validateEvals() {
  console.log('=== Development Kit Evaluation Validator ===\n');

  if (!fs.existsSync(EVALS_DIR)) {
    console.error('FAIL: evals directory not found');
    process.exit(1);
  }

  const dirs = fs.readdirSync(EVALS_DIR).filter(name => {
    return fs.statSync(path.join(EVALS_DIR, name)).isDirectory();
  });

  let totalFiles = 0;
  let totalErrors = 0;

  for (const dirName of dirs) {
    const dirPath = path.join(EVALS_DIR, dirName);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      console.error(`✖ Evaluation directory ${dirName} has no JSON scenarios`);
      totalErrors++;
      continue;
    }

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(dirPath, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data.skill || !data.scenario || !data.expected) {
          console.error(`✖ ${dirName}/${file}: missing required keys (skill, scenario, expected)`);
          totalErrors++;
        } else {
          console.log(`  ✓ ${dirName}/${file}`);
        }
      } catch (err) {
        console.error(`✖ ${dirName}/${file}: Invalid JSON (${err.message})`);
        totalErrors++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  ${totalFiles} scenarios checked across ${dirs.length} categories`);

  if (totalErrors > 0) {
    console.error(`\nValidation failed with ${totalErrors} error(s).`);
    process.exit(1);
  } else {
    console.log(`\nAll evaluation scenarios passed validation.`);
  }
}

validateEvals();
