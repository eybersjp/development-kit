# /dk-control

The `/dk-control` command launches the local Development Kit Control Center web interface.

## Purpose

Provides a browser-based, offline, local dashboard to inspect:
- Active lifecycle stage and workflow status
- Project identity and configuration
- Persistent project memory and architectural decisions
- Intelligence providers and health status
- Project and global settings

## Syntax

```text
/dk-control
```

## Behavior

1. Ensures project-local runtime state (`.development-kit/`) is bootstrapped.
2. Starts the loopback Control Center web service (`127.0.0.1:<port>`).
3. Opens the Control Center UI in the system web browser (or outputs the URL if headless/CI).
4. Generates and uses session capability tokens for secure, loopback-only communication.

## Related Commands

- [`/dk-status`](dk-status.md) - Display workflow state and blockers in the chat interface
- [`/dk-autopilot`](dk-autopilot.md) - Run guided lifecycle workflow
