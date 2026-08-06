# Security Review

Security Review is a conditional review stage triggered whenever changes touch security-sensitive code paths.

## Trigger Conditions

The security reviewer is activated for changes involving:
- Authentication & authorization logic
- Input validation & user input processing
- File handling, paths, and filesystem access
- Database queries and ORM operations
- Secrets, credentials, or API tokens
- External network requests and API endpoints
- Personally Identifiable Information (PII) handling

## Review Scope

- Sanitization and validation of all incoming input
- Prevention of common vulnerability classes (OWASP Top 10)
- Exposure of sensitive environment variables or credentials
- Secure execution of shell commands

## Related Documentation

- [Threat Model](threat-model.md)
- [Code Quality Review](code-quality-review.md)
