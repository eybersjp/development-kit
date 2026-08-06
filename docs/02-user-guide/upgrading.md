# Upgrading Development Kit

To upgrade an existing Development Kit installation to a newer version (e.g. updating from `0.2.1` to `0.3.0`):

## Project Upgrade Steps

1. Pull latest framework source or update npm package:
   ```bash
   npm install development-kit@latest
   ```
2. Run installer with `--force` to update core plugin files while preserving project configuration:
   ```bash
   node scripts/install-antigravity.mjs --project --force
   ```
3. Synchronise plugin manifest:
   ```bash
   node scripts/sync-plugin.mjs --fix
   ```
4. Run doctor check:
   ```bash
   npm run doctor
   ```
