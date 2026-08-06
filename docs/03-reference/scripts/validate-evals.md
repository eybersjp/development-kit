# Script Reference: `scripts/validate-evals.mjs`

## Overview

The `validate-evals.mjs` script validates the structure, key completeness, and JSON syntax of all evaluation scenario files in `evals/`.

## Usage

```bash
node scripts/validate-evals.mjs
# or via npm
npm run evals:validate
```

## Validation Rules

- Every evaluation category directory in `evals/` must contain at least one `.json` scenario file.
- Every scenario file must parse as valid JSON.
- Every scenario file must define `skill`, `scenario`, `input`, and `expected` fields.
