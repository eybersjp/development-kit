---
name: security-review
description: >-
  Conditional specialist review for tasks involving authentication,
  authorisation, user input, secrets, file handling, database access,
  external APIs, payments, or PII.
---

# Security Review

## Overview

A conditional specialist review activated when the task involves authentication, authorisation, user input, secrets, file handling, database access, external APIs, payments, or personally identifiable information (PII).

## When to Use

Activate when the implementation involves:
- Authentication or session management
- Authorisation or permission checks
- User input processing (forms, search, file uploads)
- Secrets, tokens, API keys, or credentials
- File uploads, downloads, or processing
- Database queries (especially with user-provided values)
- External API calls
- Payment or financial data processing
- Personally identifiable information (PII)
- Encryption, hashing, or cryptographic operations

## Process

### 1. Assess Scope

Determine which security domains are relevant to the implementation.

### 2. Review Each Domain

**Input Validation**
- Is input validated on the server (not just client-side)?
- Are there injection vulnerabilities (SQL, NoSQL, command, LDAP, XSS)?
- Are file uploads validated (type, size, content, path traversal)?
- Are URLs and redirects validated against open redirect attacks?
- Is input properly sanitised before display (XSS prevention)?

**Authentication**
- Are authentication checks enforced on all protected endpoints?
- Is password storage secure (using a strong hashing algorithm)?
- Are session tokens secure (random, not predictable)?
- Is multi-factor authentication used where appropriate?
- Are password reset flows secure (token expiration, email verification)?

**Authorisation**
- Are permissions checked at every access point (not just UI hiding)?
- Is there a risk of privilege escalation?
- Are admin endpoints protected?
- Is object-level access control enforced?

**Data Protection**
- Is sensitive data encrypted in transit (TLS)?
- Is sensitive data encrypted at rest?
- Are secrets stored securely (environment variables, secret manager)?
- Is PII handled according to regulations (GDPR, CCPA, etc.)?
- Are logging practices safe (no sensitive data in logs)?
- Is data minimisation practised (only collect what's needed)?

**API Security**
- Is rate limiting applied?
- Are CORS settings restrictive (not `Access-Control-Allow-Origin: *`)?
- Are API keys validated and rotated?
- Do error responses avoid information leakage (no stack traces, internal paths)?
- Are HTTP security headers set (CSP, HSTS, X-Frame-Options)?

**Dependencies**
- Are new dependencies from trusted sources?
- Are there known vulnerabilities in new dependencies?
- Are dependencies kept up-to-date?

### 3. Prioritise Findings

| Severity | Meaning |
|----------|---------|
| **Critical** | Immediate security vulnerability — must fix before proceeding |
| **Major** | Significant security risk — should fix before shipping |
| **Minor** | Security best practice — should document as known issue |
| **Info** | Observation — no action required |

### 4. Report

Provide a clear security verdict with actionable findings.

## Security Review Template

```
## Security Review

### Verdict: PASS / FAIL / PASS WITH ISSUES

### Scope Reviewed
[Authentication, Authorisation, Input Validation, Data Protection, API Security, Dependencies]

### Findings

**Critical**
- [Vulnerability] — [Location] — [Recommendation]

**Major**
- [Vulnerability] — [Location] — [Recommendation]

**Minor**
- [Issue] — [Location] — [Recommendation]

### Mitigations Applied
- [Mitigation 1]
- [Mitigation 2]

### Recommendations
[Summary of required changes]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This is an internal tool, it doesn't need security review" | Internal tools are attacked too, often more easily since they have less scrutiny. |
| "We'll add security later" | Security added later is more expensive and less effective. Review now. |
| "The framework handles security" | Frameworks provide tools, not guarantees. Misuse creates vulnerabilities. |
| "No one will find this endpoint" | Security through obscurity is not security. Protect all endpoints. |
| "We trust our users" | Trust is not a security measure. Validate all input from all sources. |

## Red Flags

- Input is trusted from any source without validation
- SQL queries use string concatenation with user input
- Secrets are hardcoded in source code or configuration
- Authentication checks are missing on some endpoints
- Error responses include stack traces or internal details
- CORS is configured as `*` in production
- File uploads are not validated
- Password storage uses outdated algorithms (MD5, SHA1)
- Session tokens are predictable or not rotated

## Verification

- [ ] All input is validated on the server
- [ ] Injection vulnerabilities are addressed (SQL, XSS, command)
- [ ] Authentication is enforced on all protected endpoints
- [ ] Authorisation checks are at every access point
- [ ] Secrets are not in the codebase
- [ ] Sensitive data is encrypted in transit and at rest
- [ ] Error responses do not leak sensitive information
- [ ] CORS is configured correctly
- [ ] Rate limiting is applied where appropriate
- [ ] Dependencies are from trusted sources with no known vulnerabilities
