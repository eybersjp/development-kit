# Verifying Installation

After installing Development Kit, run the following commands to confirm integrity.

## Step 1: Validate Skills & Structure

```bash
npm run validate
```

Expected output (abbreviated):
```text
=== Development Kit Validator ===

--- Skills ---

Skill: acceptance-criteria-writing
  ✓ name: acceptance-criteria-writing
  ✓ description present
  ✓ Section: Overview
  ✓ Section: Process
...
=== Summary ===
  277 checks passed
```

## Step 2: Doctor Check (Plugin Sync)

```bash
npm run doctor
```

Expected output:
```text
Plugin manifest check:
  Skills: 43 defined, 43 available
  Agents: 18 defined, 18 available
  Hooks: 4 defined, 4 available

  ✓ Plugin is in sync
```

## Step 3: Validate Documentation

```bash
npm run docs:validate
```

Expected output:
```text
=== Development Kit Documentation Validator ===

--- Documentation Coverage Checks ---
  ✓ Command reference page exists: dk-build-auto.md
  ✓ Command reference page exists: dk-build.md
  ...
  ✓ All coverage checks passed
```

If any check fails, see [Troubleshooting](troubleshooting.md).
