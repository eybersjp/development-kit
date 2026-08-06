# Known Limitations

This document records known technical or architectural limitations in Development Kit version 0.3.0.

## List of Limitations

1. **Local File Path Interoperability**: Windows backslash path separators in user prompts must be converted to forward slashes for internal cross-platform links.
2. **Sub-Agent Context Budgeting**: High-complexity tasks with over 50 files require explicit chunking via `context-packing`.
3. **Sequential Task Execution**: Parallel task execution is not supported by default to guarantee strict task loop gate ordering.

## Related Documentation

- [Unresolved Decisions](unresolved-decisions.md)
- [Architecture Decisions](../04-architecture/architecture-decisions.md)
