# Development Workflow

The development workflow for contributors submitting changes to Development Kit.

## Workflow

1. Fork the repository and create a feature branch (`feature/your-feature-name`).
2. Implement your changes using TDD and Development Kit methodology.
3. Keep changes in canonical source files (`skills/`, `agents/`, `commands/`).
4. Run `node scripts/sync-plugin.mjs --fix` to update the plugin mirror.
5. Run `npm run validate` and `npm run docs:validate`.
6. Open a Pull Request.

## Related Documentation

- [Contribution Overview](contribution-overview.md)
- [Pull Request Requirements](pull-request-requirements.md)
