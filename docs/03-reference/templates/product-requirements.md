# product-requirements

**Source**: `templates/product-requirements.md` · **Frontmatter**: `name: product-requirements`

## Intended Lifecycle Stage

DEFINE — comprehensive projects only.

## Intended User / Agent

product-discovery-agent / specification-agent (output of `/dk-idea` → `/dk-spec` for comprehensive work).

## Purpose

Full product requirements document: problem, vision, target audience, user journeys, functional and non-functional requirements, scope, acceptance criteria, risks, and glossary.

## Required Sections

Overview (problem, vision, audience) · User Journeys · Functional Requirements (REQ-IDs) · Non-Functional Requirements (performance, security, accessibility, compatibility) · Scope (in/out) · Acceptance Criteria · Risks and Mitigations · Glossary

## Optional Sections

None (all expected for comprehensive projects).

## How the Template Is Selected

Used only at the `comprehensive` artifact level (CRM module, payment system, new product).

## How It Should Be Completed

- Functional requirements numbered as `REQ-001` style
- Non-functional requirements explicitly covered (they are frequently forgotten)
- Risks as a table with impact, likelihood, mitigation

## Validation Expectations

- Every functional requirement has a linked acceptance criterion
- Out-of-scope items listed
- Risks have mitigations

## Related

[artifact-selector-agent](../agents/artifact-selector-agent.md), [scope-definition](../skills/scope-definition.md).
