# Product Evidence and Public Demonstration

This section defines how Development Kit should prove its value publicly through real screenshots, short demonstrations, a complete product video, and investor-facing evidence.

## Objective

The evidence system must answer four questions quickly:

1. What problem does Development Kit solve?
2. What does the product actually do inside a supported coding agent?
3. What controls prevent unsafe or unverified automation?
4. What measurable engineering assets and validation systems support the product claim?

## Audience tracks

### Public and prospective users

Show that installation is simple, the recommended workflow is understandable, and the product guides users without requiring them to memorize every command.

Primary evidence:

- Quick installation animation
- OpenCode startup menu screenshot
- 90-second overview video
- Clear link to the public npm package

### Developers and technical evaluators

Show deterministic lifecycle state, specialist routing, approval gates, tests, evaluations, and release validation.

Primary evidence:

- Autopilot lifecycle status screenshot
- Approval-gate screenshot
- Release-validation screenshot
- Technical walkthrough with commands visible
- Links to runtime, tests, evaluations, and architecture documentation

### Potential investors and strategic partners

Show the category problem, differentiated workflow architecture, product defensibility, repeatability, and evidence that Development Kit is a maintained public product rather than a prompt collection.

Primary evidence:

- Two-minute investor narrative
- Architecture and workflow diagram
- Current component and validation metrics
- Public npm and GitHub release proof
- Roadmap and adoption instrumentation plan

## Evidence hierarchy

Use the following order on public pages:

1. One strong hero screenshot or clickable demo thumbnail
2. One short animated demonstration
3. Three to five focused screenshots with outcome captions
4. One full product walkthrough
5. Technical proof links and validation metrics
6. Investor narrative and roadmap material

Do not overload the root README with every asset. The README should create understanding and confidence quickly, then link to a deeper showcase page.

## Required deliverables

- [Capture plan](capture-plan.md)
- [Video storyboard and narration](video-storyboard.md)
- [Investor demonstration narrative](investor-demo-narrative.md)
- [README showcase template](readme-showcase-template.md)
- [Recording and privacy checklist](recording-checklist.md)
- [Media standards](../../media/README.md)

## Acceptance criteria

The first evidence release is ready when:

- Five canonical screenshots exist and use consistent dimensions and styling.
- Two short repository-friendly demonstrations exist.
- A captioned 60 to 90 second public overview video is hosted at a stable URL.
- The root README contains a concise `See Development Kit in action` section.
- The showcase page explains each function using real output.
- All assets are free of secrets, private repository data, personal notifications, and unrelated account information.
- Every claim shown in a caption is supported by the displayed product state or linked source documentation.
- The documentation and link validators pass.

## Success measures

After publication, track:

- README-to-demo click-through rate
- Demo completion rate
- Repository stars and forks
- npm downloads
- Issue and discussion quality
- Installation failures reported by environment
- Conversion from demo viewers to repository visitors or package users

These measures should be introduced only after a privacy-conscious analytics approach is approved.
