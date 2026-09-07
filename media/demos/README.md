# Demo Media

This directory contains short, repository-friendly demonstrations and notes that point to the hosted full product video.

## Recommended public media set

### Quick install

A 10 to 15 second silent or captioned animation showing:

1. `npm view development-kit version`
2. `npx development-kit@0.4.2 init --opencode --dry-run`
3. The generated file plan

Target filename: `quick-install.webp`

### Autopilot overview

A 20 to 35 second animation showing:

1. OpenCode loading the Development Kit workspace
2. The recommended automated workflow entry
3. `/dk-autopilot` selecting a lifecycle action
4. A visible pause at a human approval gate
5. `/dk-status` or equivalent state evidence

Target filename: `autopilot-overview.webp`

## Full video

The full demonstration should be hosted externally and represented in the README with `../social/product-demo-thumbnail.png` linked to the public video URL.

Do not commit large master video files to the npm package. Keep editable source footage outside the package and retain an archive copy under maintainer control.

## Editing requirements

- Add captions.
- Remove idle time and repeated typing.
- Use modest speed changes only when disclosed.
- Keep commands and outcomes readable.
- Avoid music that competes with narration.
- Include a closing frame with the repository name, npm package, and current version.
