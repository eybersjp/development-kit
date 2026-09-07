# Product Evidence Media

This directory is the canonical home for public screenshots, animated demonstrations, video thumbnails, and social-preview assets for Development Kit.

## Evidence standard

All product evidence must show real Development Kit behaviour from a clean or clearly identified test workspace.

Do not present mock interfaces, generated terminal output, staged validation results, or AI-generated UI as execution evidence. Illustrative graphics may be used for branding, but they must be labelled as illustrations rather than product screenshots.

## Directory structure

```text
media/
├── screenshots/   # Static PNG or WebP product captures
├── demos/         # Short GIF or WebP demonstrations and local video source notes
├── social/        # Repository social-preview and campaign artwork
└── README.md
```

## Required launch assets

| Asset | Purpose | Preferred format |
|---|---|---|
| `screenshots/opencode-startup-menu.png` | Proves the recommended workflow entry experience | PNG, 1600 x 900 |
| `screenshots/autopilot-lifecycle-status.png` | Shows persistent lifecycle state and the current action | PNG, 1600 x 900 |
| `screenshots/approval-gate.png` | Demonstrates human control over consequential operations | PNG, 1600 x 900 |
| `screenshots/release-validation.png` | Shows the complete verification suite passing | PNG, 1600 x 900 |
| `screenshots/npm-installation.png` | Demonstrates public installation from npm | PNG, 1600 x 900 |
| `demos/quick-install.webp` | Fast installation proof for the README | Animated WebP or GIF, under 8 MB |
| `demos/autopilot-overview.webp` | Short product workflow demonstration | Animated WebP or GIF, under 10 MB |
| `social/repository-preview.png` | GitHub and social sharing preview | PNG, 1280 x 640, under 1 MB |
| `social/product-demo-thumbnail.png` | Clickable thumbnail for the hosted full demo | PNG, 1280 x 720 |

## Full video hosting

Keep the source recording and edited master outside the npm package. Publish the final demonstration to a stable public host such as YouTube or Vimeo, then link to it from a repository thumbnail.

A short MP4 may also be attached to a GitHub issue, pull request, discussion, or release for direct evidence and review. Browser codec support can vary, so the repository should retain a static thumbnail and written walkthrough as fallbacks.

## Capture rules

1. Use Development Kit v0.4.2 or later and show the version on screen.
2. Use a dedicated demo workspace with no customer data, secrets, personal paths, email addresses, tokens, or unrelated repositories.
3. Use a consistent 16:9 recording frame, ideally 1920 x 1080.
4. Increase terminal and editor font sizes so text remains readable on mobile.
5. Hide notifications, bookmarks, account avatars, unrelated tabs, and personal desktop content.
6. Keep cursor movement deliberate and remove dead time during editing.
7. Caption every public video and provide a short written transcript.
8. State clearly when a sequence is shortened, accelerated, or edited.
9. Preserve the original unedited recording privately for authenticity review.
10. Re-record evidence when a release materially changes the demonstrated behaviour.

## File naming

Use lowercase kebab-case names. Avoid dates in canonical filenames so README links remain stable across refreshes. Record the captured Development Kit version and source recording date in the pull request that adds or replaces each asset.
