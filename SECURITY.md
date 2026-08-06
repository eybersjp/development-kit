# Security Policy

## Supported versions

Security fixes are provided for the latest published minor release. Users should upgrade to the newest available version before reporting an issue that may already be resolved.

| Version | Supported |
|---|---|
| Latest release | Yes |
| Earlier releases | Best effort |

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities.

Use GitHub's private vulnerability reporting feature for this repository. Include:

- Affected version or commit.
- The relevant component and execution environment.
- Reproduction steps or a minimal proof of concept.
- Potential impact.
- Any suggested mitigation.

Do not include real credentials, private keys, customer information, or third-party confidential data.

## Response process

The maintainer will aim to:

1. Acknowledge a complete report within five business days.
2. Validate severity and affected versions.
3. Coordinate a fix and release timeline.
4. Credit the reporter when requested and appropriate.

Timelines depend on reproducibility, severity, and maintainer availability. No guaranteed service-level agreement is offered.

## Scope

Reports are especially valuable for:

- Approval or confirmation token bypass.
- Workflow-state tampering or cross-project state confusion.
- Secret exposure in logs, state, diagnostics, or generated artifacts.
- Unsafe execution of destructive, remote, deployment, publishing, or authentication operations.
- Installer path traversal or unintended file overwrite.
- Command or agent prompt paths that bypass mandatory approval gates.

General product questions and non-security bugs should use the public issue templates.
