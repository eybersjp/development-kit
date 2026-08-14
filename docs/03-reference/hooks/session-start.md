# session-start

**Source**: `hooks/session-start.js` · **Language**: JavaScript (CommonJS)

## Trigger Point

Beginning of every Antigravity session in a Development Kit project. Runs once per session.

## Purpose

- Load the `using-development-kit` skill (teaches the methodology)
- Load `AGENTS.md` always-on rules
- Display the Development Kit banner
- Make session-start data available to other hooks

## Inputs

None (session start has no task context).

## Outputs

Exports a `session` object:

```javascript
{
  startedAt: ISO timestamp,
  methodology: 'development-kit',
  version: '0.1.0',
  rules: [ ... 12 always-on rule keys ... ]
}
```

## Side Effects

- Session metadata is available to other hooks via the module export

## Environment Assumptions

- Node.js environment with CommonJS module support
- Antigravity hook runtime

## Exit Behavior

Returns the `session` object; the session then proceeds normally.

## Blocking Behavior

Non-blocking — a hook failure does not stop the session.

## Failure Handling

No explicit error handling; the hook is metadata-only.

## Security Considerations

No privileged operations; exposes only the rule keys.

## Relationship to Lifecycle

Frames the entire lifecycle by orienting the agent at session start (see [using-development-kit](../skills/using-development-kit.md)).

## Maintenance Notes

The hard-coded `version: '0.1.0'` does not track `package.json` (`0.6.1`) — a known inconsistency recorded in [known-limitations.md](../../11-appendices/known-limitations.md).
