# Reinstalling Development Kit

If your plugin manifest or skill files become corrupted or out of sync, perform a clean reinstallation:

```bash
# Re-run installer with force flag
node scripts/install-antigravity.mjs --project --force

# Sync plugin manifest
node scripts/sync-plugin.mjs --fix

# Validate installation integrity
npm run doctor
```
