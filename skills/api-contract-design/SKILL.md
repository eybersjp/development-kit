---
name: api-contract-design
description: >-
  Designs API contracts and module boundaries. Used only when APIs or module
  boundaries are being defined or changed.
compatibility: opencode
---

# API Contract Design

## Overview

Designs API contracts and module boundaries. Used only when APIs (internal or external) or module interfaces are being defined or changed. A good API contract is minimal, consistent, and predictable.

## When to Use

- When defining a new API endpoint or endpoint group
- When changing an existing API contract
- When defining module boundaries between system components
- When integrating with external services
- When designing inter-service communication

## Process

### 1. Understand Requirements

Review the specification and technical design to understand what the API needs to do.

### 2. Apply the Ponytail Ladder

Before designing new endpoints:
1. Can an existing endpoint be extended?
2. Can an existing module interface be reused?
3. Is a new endpoint genuinely needed?

### 3. Design Endpoints

For each endpoint:

**Method and Path**
- Use RESTful conventions or framework conventions
- Use consistent naming patterns
- Use plural nouns for resources

**Request**
- Required and optional parameters
- Request body structure (for POST, PUT, PATCH)
- Headers and authentication requirements
- Content type expectations

**Response**
- Success response structure
- Error response structure (consistent format)
- HTTP status codes (use appropriate codes)
- Pagination format (for list endpoints)

**Error Handling**
- Error response format
- Error codes and messages
- Validation error format
- Rate limiting headers and response

### 4. Design Module Interfaces

For internal module boundaries:
- **Exported functions**: Signatures, parameters, return types
- **Events**: What events the module emits
- **Dependencies**: What the module depends on
- **Side effects**: What state changes occur

### 5. Document the Contract

Produce API or interface documentation.

## API Contract Template

```
## API: [Resource Name]

### [METHOD] /api/v1/[resource]

**Authentication**: [Required/Optional/None]
**Content-Type**: application/json

#### Request
- **Path parameters**: [parameters]
- **Query parameters**: [parameters]
- **Body**: [structure]

#### Response 200
```json
{
  "status": "success",
  "data": { ... }
}
```

#### Response 4xx/5xx
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable message"
}
```

#### Errors
| HTTP Status | Code | When |
|-------------|------|------|
| 400 | VALIDATION_ERROR | Invalid input |
| 401 | UNAUTHORIZED | Missing or invalid auth |
| 404 | NOT_FOUND | Resource not found |
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll design the API as I implement it" | API design errors are expensive to fix. Design first. |
| "This API is simple, I don't need to document it" | Simple APIs have consumers. Document the contract. |
| "I'll just return whatever data seems useful" | Every extra field is a commitment. Design the response minimally. |
| "I'll use a generic endpoint for everything" | Generic endpoints are hard to maintain and extend. Design specific endpoints. |

## Red Flags

- New endpoints are added when existing ones could be extended
- Error responses are inconsistent across endpoints
- Response bodies include unnecessary data
- No versioning strategy is defined
- Endpoints expose internal implementation details
- Authentication and authorisation are not clearly defined

## Verification

- [ ] Each endpoint is justified (not created unnecessarily)
- [ ] Request and response structures are clearly defined
- [ ] Error responses are consistent across all endpoints
- [ ] Authentication and authorisation are defined
- [ ] The contract follows existing API conventions
- [ ] Pagination is defined for list endpoints (if applicable)
