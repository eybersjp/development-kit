---
name: release-readiness
description: >-
  Performs the broader pre-release check: full test suite, security scan,
  performance check, documentation review, and deployment preparation.
---

# Release Readiness

## Overview

Performs the broader pre-release check. Goes beyond individual task completion to verify that the entire project is ready for release. Includes full test suite, security scan, performance check, documentation review, dependency audit, and deployment preparation.

## When to Use

- Before a major release or deployment
- When all features in a release are complete
- Before merging to the production branch
- When the `/ship` command indicates a full release

## Process

### 1. Full Test Suite

Run the complete project test suite:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All end-to-end tests pass
- [ ] Type checking passes with no errors
- [ ] Linting passes with no errors
- [ ] Build process completes successfully

### 2. Security Scan

- [ ] Dependency audit: no known vulnerabilities in dependencies
- [ ] Secrets scan: no secrets, API keys, or credentials in the codebase
- [ ] SAST scan: static analysis for security vulnerabilities (if available)
- [ ] OWASP Top 10 check: review for common vulnerabilities

### 3. Performance Check

- [ ] Bundle size is within acceptable limits (if frontend project)
- [ ] API response times are within acceptable limits
- [ ] Database query performance is acceptable (no N+1, missing indexes)
- [ ] Asset sizes are optimised (images, fonts, bundles)

### 4. Documentation Review

- [ ] README is up to date
- [ ] API documentation reflects current endpoints
- [ ] Changelog includes all changes
- [ ] Migration guides are provided (if applicable)
- [ ] Configuration changes are documented

### 5. Dependency Audit

- [ ] No new unused dependencies
- [ ] Dependencies are pinned to known versions (not ranges)
- [ ] Licenses are compatible with the project
- [ ] No deprecated dependencies remain

### 6. Deployment Preparation

- [ ] Configuration for all environments is ready
- [ ] Database migrations are finalised and tested
- [ ] Rollback plan exists for the release
- [ ] Monitoring and alerting are configured
- [ ] Release notes are prepared

### 7. Final Go/No-Go Decision

Based on the above checks, determine:

- **GO**: All checks pass. Ready for release.
- **GO WITH CAVEATS**: Non-blocking issues exist. Document and proceed.
- **NO-GO**: Blocking issues exist. Resolve before release.

## Release Readiness Checklist

```
### Tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Build succeeds

### Security
- [ ] No known dependency vulnerabilities
- [ ] No secrets in codebase
- [ ] Security review passed (if applicable)

### Performance
- [ ] Bundle size acceptable
- [ ] API response times acceptable
- [ ] Query performance acceptable

### Documentation
- [ ] README up to date
- [ ] Changelog updated
- [ ] API docs current

### Deployment
- [ ] Migrations finalised
- [ ] Rollback plan exists
- [ ] Configuration ready
- [ ] Release notes prepared

### Decision
[GO / GO WITH CAVEATS / NO-GO]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "We've been testing during development, we don't need a final check" | Integration issues often appear at the end. Run the full check. |
| "Security scans take too long" | Skipping security is how breaches happen. Run the scan. |
| "The release is urgent, we can't delay for checks" | Urgent releases still need verification. If it's too urgent to test, it's too risky to release. |
| "Performance doesn't matter for this release" | Performance regressions accumulate. Check performance with every release. |

## Red Flags

- The release checklist is not completed
- Security scans are skipped
- Performance has not been considered
- Documentation is out of date
- No rollback plan exists
- Dependencies have known vulnerabilities
- The build process is not automated
- "We'll fix it in the next release" is accepted for blocking issues

## Verification

- [ ] Full test suite passes
- [ ] Security scan is clean
- [ ] Performance is acceptable
- [ ] Documentation is current
- [ ] Dependencies are clean (no vulnerabilities, unused packages)
- [ ] Deployment plan is ready with rollback
- [ ] Go/no-go decision is made based on evidence
