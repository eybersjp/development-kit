# Security-Sensitive Change

Walkthrough of modifying authentication, authorization, or input processing code.

## Key Phases

- **Threat Modeling**: Identify security trust boundaries and potential attack vectors during `/dk-design`.
- **Implementation Restraint**: Strict input sanitization and parameter checks.
- **Specialist Security Review**: Mandatory `security-reviewer` pass verifying protection against OWASP Top 10 vulnerabilities.

## Related Documentation

- [Security Review](../07-testing-quality-security/security-review.md)
- [Threat Model](../07-testing-quality-security/threat-model.md)
