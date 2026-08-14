# Compatibility Matrix

This matrix records Development Kit package, runtime, and host compatibility.

| Development Kit version | Node.js | Platforms | Antigravity | OpenCode | Standalone |
|---|---|---|---|---|---|
| `v0.6.1` (proposed) | `>=18.0.0` | Windows, macOS, Linux | Supported with Next-Step Guidance, 46 skills, and standalone runtime | Supported with 46 progressively discovered skills | Supported with packaged runtime |
| `v0.6.0` | `>=18.0.0` | Windows, macOS, Linux | Supported with multi-platform adapters | Supported with 45 progressively discovered skills | Supported |
| `v0.5.2` | `>=18.0.0` | Windows, macOS, Linux | Supported; canonical plugin mirror checks normalize CRLF/LF differences | Supported with 45 progressively discovered skills | Supported |
| `v0.5.1` | `>=18.0.0` | Windows, macOS, Linux | Supported with synchronized external-research components | Supported with provider-neutral external research | Supported |
| `v0.5.0` | `>=18.0.0` | Windows, macOS, Linux | Supported with optional External Capability Providers | Supported with `/dk-research` and 45 skills | Supported |
| `v0.4.2` | `>=18.0.0` | Windows, macOS, Linux | Supported | Supported with official schema-based `opencode.json` | Supported |
| `v0.4.1` | `>=18.0.0` | Windows, macOS, Linux | Supported | Upgrade required when the generated `opencode.json` contains obsolete `rules` | Supported |
| `v0.4.0` | `>=18.0.0` | Windows, macOS, Linux | Supported | Use v0.4.2 for current compatibility | Supported |
| `v0.3.0` | `>=18.0.0` | Windows, macOS, Linux | Legacy baseline | Legacy integration | Legacy standalone baseline |

## Current OpenCode contract

Development Kit v0.6.1 installs:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads root `AGENTS.md` and progressively discovers the 46 compatible skills under `.opencode/skills/`.

The top-level `rules` key is not supported by current OpenCode and is rejected by the current v0.6.1 release validation suite.

## Runtime policy

- Minimum supported Node.js version: 18.
- CI and release workflows currently run Node.js 22.
- Cross-platform repository paths should be stored in normalized repository-relative form where applicable.
- Shell examples may require platform-specific quoting.

## Support policy

The latest published patch release is the recommended version. Earlier releases receive best-effort support, but users should reproduce issues against the latest package before reporting them.

## Related documentation

- [Migration Guide](migration-guide.md)
- [OpenCode Integration](../04-architecture/opencode-integration.md)
- [Platform Path Reference](../11-appendices/platform-path-reference.md)
- [Security Policy](../../SECURITY.md)
