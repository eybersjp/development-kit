# Repeatable Demo Project Brief

Use one neutral, disposable project for all public Development Kit demonstrations so screenshots and videos remain consistent across releases.

## Project concept

Build a small issue-tracking service named `RelayBoard`.

The demo request is:

> Add a project status endpoint that returns application health, current version, and the number of open work items. Include tests, documentation, and safe release preparation.

This request is intentionally small enough for a public demonstration while still exercising discovery, specification, design, planning, implementation, verification, review, simplification, and completion.

## Suggested starting repository

```text
relayboard-demo/
├── package.json
├── src/
│   ├── app.js
│   └── work-items.js
├── test/
│   └── work-items.test.js
└── README.md
```

Use only synthetic data.

## Demonstration goals

The demo should visibly show Development Kit:

1. Inspecting the existing repository before editing
2. Clarifying the required endpoint and acceptance criteria
3. Producing the minimum necessary specification
4. Creating a small implementation plan
5. Selecting a focused implementation task
6. Running or requesting tests
7. Reviewing specification compliance and code quality
8. Simplifying unnecessary complexity
9. Stopping for approval before any remote or release action

## Safety boundary

Use a local-only repository or a dedicated public demo repository with no production deployment, credentials, customer data, or protected resources.

Do not configure a real deployment target for the recording. A release or push approval gate may be demonstrated without completing the remote action.

## Reset procedure

Before each recording:

1. Delete the previous demo workspace.
2. Restore the clean starter repository.
3. Confirm no `.development-kit` state remains from a prior run.
4. Confirm the current Development Kit version.
5. Run the intended capture sequence once without recording.
6. Reset again and begin the final recording.

## Reproducibility record

The pull request that adds each evidence set should record:

- Starter repository commit
- Development Kit version
- OpenCode version
- Node.js version
- Operating system
- Commands executed
- Any edited or accelerated sections
