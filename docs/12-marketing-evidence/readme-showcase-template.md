# README Product Showcase Template

Use this section in the root README only after the referenced assets and public video URL exist.

```markdown
## See Development Kit in action

[![Watch the Development Kit product demo](media/social/product-demo-thumbnail.png)](PUBLIC_VIDEO_URL)

**Watch the 90-second product overview** to see installation, the guided OpenCode entry experience, `/dk-autopilot`, persistent lifecycle state, human approval gates, and release validation.

### Guided workflow

![OpenCode showing the recommended Development Kit automated guided workflow](media/screenshots/opencode-startup-menu.png)

Development Kit provides one guided entry point, then selects the appropriate lifecycle action, command, agent, and skills.

### Persistent lifecycle state

![Development Kit Autopilot showing the current lifecycle stage and next action](media/screenshots/autopilot-lifecycle-status.png)

The workflow progresses through `UNDERSTAND > DEFINE > DESIGN > PLAN > IMPLEMENT > VERIFY > REVIEW > SIMPLIFY > COMPLETE` and records state between sessions.

### Human control for consequential actions

![Development Kit requesting explicit approval before a consequential operation](media/screenshots/approval-gate.png)

Remote, destructive, deployment, publishing, release, and security-sensitive actions stop for explicit authorization.

### Validation evidence

![Development Kit release validation suite passing](media/screenshots/release-validation.png)

The release gate validates framework structure, plugin synchronization, documentation, OpenCode configuration, the Autopilot runtime, and behavioural evaluation scenarios.

[View the complete evidence walkthrough](docs/12-marketing-evidence/product-showcase.md)
```

## Placement

Insert the final section after `Current release` and before the detailed capability table. This gives visitors immediate product proof before they encounter the complete technical inventory.

## Publishing rule

Do not merge broken image references, placeholder URLs, fabricated screenshots, or a `coming soon` hero section into the public README. Keep this template on the marketing branch until every referenced asset is real and reviewed.
