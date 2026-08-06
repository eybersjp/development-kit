# Rollback and Recovery

Procedure for rolling back a release or recovering from a failed deployment.

## Rollback Steps

1. **Git Revert**: Revert the release commit on `main`.
2. **Deprecate Version**: Mark npm version as deprecated: `npm deprecate development-kit@X.Y.Z "Critical issue detected, upgrade to X.Y.Z+1"`.
3. **Re-publish**: Publish corrected version immediately.

## Related Documentation

- [Release Process](release-process.md)
- [Release Manager Runbook](release-manager-runbook.md)
