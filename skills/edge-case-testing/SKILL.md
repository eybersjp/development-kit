---
name: edge-case-testing
description: >-
  Actively searches for failure scenarios, boundary conditions, and
  unexpected inputs. Tests are designed to break the implementation.
---

# Edge Case Testing

## Overview

Actively searches for failure scenarios, boundary conditions, and unexpected inputs. While standard TDD covers intended behaviour, edge-case testing deliberately tries to break the implementation. This skill finds the gaps that normal testing misses.

## When to Use

- After the TDD cycle (happy path + basic edge cases)
- Before marking a task as complete
- For critical or high-risk features
- When the implementation involves user input, file handling, network requests, or concurrent access

## Process

### 1. Identify Input Surfaces

Find all places where the implementation accepts input:
- Form fields and user input
- API request parameters
- File uploads
- Configuration values
- Environment variables
- URL parameters
- Database query results
- External API responses

### 2. Design Edge Cases

For each input surface, test:

**Boundary Values**
- Minimum allowed value
- Maximum allowed value
- Values just below minimum and just above maximum
- Zero (for numeric inputs)
- Empty string
- String of maximum length
- String exceeding maximum length

**Invalid Values**
- Wrong data type (string where number expected)
- Negative numbers (where positive expected)
- Special characters
- HTML/script injection (XSS)
- SQL injection patterns
- JSON injection

**Missing Values**
- Null input
- Undefined input
- Missing required fields
- Empty arrays or objects
- Partial data (missing optional fields)

**Unexpected Values**
- Very large inputs (buffer overflow, denial of service)
- Unicode and emoji (encoding issues)
- Control characters
- Extremely nested objects (stack overflow)
- Circular references

**Concurrency**
- Rapid repeated submissions
- Multiple simultaneous operations
- Race conditions
- State modified while being read

**Environment**
- Network timeouts
- API errors
- Permission denied
- Disk full
- Memory pressure

### 3. Test Each Edge Case

For each edge case:
1. Describe the scenario
2. Define the expected behaviour (should it error? recover? handle gracefully?)
3. Write a test that validates the expected behaviour
4. Run the test and confirm the implementation handles it correctly

### 4. Document Findings

Report edge cases tested and any failures found.

## Edge Case Testing Template

```
## Edge Case Testing: [Feature]

### Input Surfaces
- [Input 1]: [Type, constraints]
- [Input 2]: [Type, constraints]

### Edge Cases Tested
| Surface | Case | Input | Expected | Result |
|---------|------|-------|----------|--------|
| Input 1 | Empty | "" | Error message | PASS |
| Input 1 | Max length | "A"*256 | Accept | PASS |
| Input 1 | Exceed length | "A"*257 | Error message | PASS |
| Input 1 | XSS | "<script>..." | Sanitised/escaped | PASS |
| Input 2 | Null | null | Error message | PASS |

### Failures Found
- [Scenario]: [What failed] → [Fix applied]

### Remaining Risks
- [Risk]: [Mitigation]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "Users won't input that" | Users will absolutely input that. Test it. |
| "The frontend validates this, so the backend doesn't need to" | Frontend validation is a convenience, not a security boundary. Always validate on the backend. |
| "This code handles the happy path, edge cases are unlikely" | Edge cases are where bugs live. If they were unlikely, they wouldn't be called edge cases. |
| "I'll add edge case handling later" | Later never comes in practice. Handle edge cases now. |

## Red Flags

- Only happy path inputs are tested
- Input validation exists but only on the client side
- Boundary values are not tested
- Security edge cases (XSS, injection) are not tested
- Concurrent access is not tested (race conditions)
- Error responses leak implementation details (stack traces, internal paths)

## Verification

- [ ] All input surfaces are identified
- [ ] Boundary values are tested (min, max, just outside)
- [ ] Invalid values are tested (wrong type, malformed, injection)
- [ ] Missing values are tested (null, undefined, empty)
- [ ] Unexpected values are tested (very large, unicode, control characters)
- [ ] Concurrency edge cases are tested where applicable
- [ ] Error responses do not leak sensitive information
