# Evidence Capture Plan

## Demo workspace

Use a dedicated folder such as:

```text
C:\Users\SSTECH\developments\dk-public-demo
```

The workspace should contain only files created for the demonstration. Do not use customer repositories, personal projects, production credentials, or private documents.

## Preparation

1. Update Development Kit and confirm the public package version.
2. Use the current stable OpenCode release.
3. Set the display to 1920 x 1080 where practical.
4. Use a readable editor and terminal font size, typically 18 to 22 px.
5. Disable notifications and hide bookmarks, personal tabs, account details, and taskbar items that reveal unrelated information.
6. Use a consistent light or dark theme across all captures.
7. Clear terminal history where it could expose private paths or commands.
8. Prepare a small, neutral demo project such as a task-tracking API or simple dashboard.

## Capture sequence

### Capture 1: Public npm installation

Show:

```powershell
npm view development-kit version
npx development-kit@0.4.2 init --opencode --dry-run
```

Evidence goal: Development Kit is publicly available and the installation plan is understandable before files are written.

Output assets:

- `media/screenshots/npm-installation.png`
- `media/demos/quick-install.webp`

### Capture 2: OpenCode startup experience

Open the demo workspace in OpenCode and capture the Development Kit recommended startup option.

Evidence goal: The user can enter the complete workflow without learning every command first.

Output asset:

- `media/screenshots/opencode-startup-menu.png`

### Capture 3: Autopilot lifecycle state

Start:

```text
/dk-autopilot
```

Capture the current lifecycle stage, selected action, and the transition to the next stage.

Evidence goal: Development Kit coordinates a defined lifecycle rather than producing an unstructured response.

Output assets:

- `media/screenshots/autopilot-lifecycle-status.png`
- `media/demos/autopilot-overview.webp`

### Capture 4: Human approval gate

Use a safe demonstration action that reaches a consequential approval boundary, such as preparing a pull request, release, or remote push without executing it automatically.

Evidence goal: Development Kit stops for explicit authorization before consequential operations.

Output asset:

- `media/screenshots/approval-gate.png`

Do not demonstrate approvals using real production credentials or a repository where accidental execution would be harmful.

### Capture 5: Verification evidence

From the Development Kit source repository, show:

```powershell
npm run release:validate
```

Capture the final summary showing the framework, documentation, OpenCode, Autopilot, and evaluation gates passing.

Evidence goal: Product claims are backed by automated validation.

Output asset:

- `media/screenshots/release-validation.png`

## Optional advanced captures

- Pause and resume across sessions
- Stale artifact detection after an upstream change
- Rejection of an invalid approval token
- Recovery from an interrupted action lease
- Manual command fallback from `/dk-autopilot`
- Antigravity installation and startup experience
- GitHub release and npm publication workflow

## Capture order

Capture static screenshots first. Then record the full video in one continuous session using the same workspace and visual settings. The short animations should be cut from the full recording so the evidence remains consistent.

## Review before publication

A second review should verify:

- Commands and version numbers are correct.
- No secret, email, username, private path, browser profile, or unrelated repository is visible.
- Captions describe only what the image proves.
- The workflow shown matches current documentation.
- The recording does not imply that approval gates were bypassed.
