# Capture and Publish Checklist

Use this checklist to complete the first Development Kit public evidence release. Keep the pull request in draft until every required gate is complete.

## 1. Record the evidence environment

- [ ] Use the dedicated `RelayBoard` demo workspace described in [the demo project brief](demo-project-brief.md).
- [ ] Restore the clean starter commit and remove previous `.development-kit` state.
- [ ] Confirm the workspace contains only synthetic data.
- [ ] Record the Development Kit, OpenCode, Node.js, and operating-system versions.
- [ ] Record the starter repository commit, capture date, and exact commands used.
- [ ] Record every crop, annotation, redaction, shortened sequence, or speed change.
- [ ] Complete an unrecorded rehearsal, reset the workspace, and then make the final captures.

## 2. Capture the five canonical screenshots

- [ ] `media/screenshots/npm-installation.png`
  - Run `npm view development-kit version`.
  - Run `npx development-kit@0.4.2 init --opencode --dry-run`.
  - Show the public version and generated file plan.
  - Export as a 1600 x 900 PNG.
- [ ] `media/screenshots/opencode-startup-menu.png`
  - Open the clean demo workspace in OpenCode.
  - Show the recommended Development Kit guided-workflow entry.
  - Export as a 1600 x 900 PNG.
- [ ] `media/screenshots/autopilot-lifecycle-status.png`
  - Start `/dk-autopilot`.
  - Show the current lifecycle stage, selected action, and next transition.
  - Export as a 1600 x 900 PNG.
- [ ] `media/screenshots/approval-gate.png`
  - Reach a safe approval boundary for a push, pull request, release, or publication action.
  - Show the explicit authorization request without executing a real consequential operation.
  - Export as a 1600 x 900 PNG.
- [ ] `media/screenshots/release-validation.png`
  - Run `npm run release:validate` from the Development Kit repository.
  - Show the final passing framework, plugin, documentation, OpenCode, Autopilot, and evaluation summary.
  - Export as a 1600 x 900 PNG.

## 3. Produce the short demonstrations

- [ ] `media/demos/quick-install.webp`
  - Show the npm version query, OpenCode dry run, and generated file plan.
  - Target 10 to 15 seconds, with readable captions, under 8 MB.
- [ ] `media/demos/autopilot-overview.webp`
  - Show OpenCode startup, the guided entry, `/dk-autopilot`, lifecycle selection, an approval pause, and state evidence.
  - Target 20 to 35 seconds, with readable captions, under 10 MB.

Cut both demonstrations from the same reviewed master recording where practical so commands, versions, and visual treatment remain consistent.

## 4. Publish the full demonstration

- [ ] Edit the reviewed master recording to 75 to 90 seconds.
- [ ] Use real Development Kit execution for every product scene.
- [ ] Add captions and a written transcript.
- [ ] Keep commands and outcomes readable at normal playback size.
- [ ] Disclose materially shortened or accelerated sequences.
- [ ] End with the repository, npm package, and captured version.
- [ ] Publish to a stable public URL that works without authentication.
- [ ] Retain the unedited source recording privately for authenticity review.

## 5. Produce the promotional artwork

- [ ] `media/social/product-demo-thumbnail.png`
  - Use a real product capture as the interface background.
  - Add Development Kit branding, a play icon, and `Watch the 90-second demo`.
  - Export as a 1280 x 720 PNG.
- [ ] `media/social/repository-preview.png`
  - Include the product name, concise value proposition, nine-stage lifecycle, supported environments, and captured public version.
  - Use real product imagery wherever an interface is shown.
  - Export as a 1280 x 640 PNG under 1 MB.
  - Configure it as the GitHub repository social-preview image.

## 6. Review privacy, accuracy, and authenticity

Complete [the recording and privacy checklist](recording-checklist.md), including these release blockers:

- [ ] All displayed output comes from real execution.
- [ ] Commands and versions match the public release.
- [ ] No secret, token, API key, email address, private URL, account detail, notification, or unrelated repository is visible.
- [ ] No unnecessary personal filesystem path is visible.
- [ ] Cropping does not hide warnings, failures, or relevant context.
- [ ] Annotations do not alter the underlying evidence.
- [ ] Captions make only claims supported by the visible evidence.
- [ ] Approval gates are shown accurately and are not bypassed.
- [ ] Every image has concise descriptive alt text.
- [ ] A separate second review has checked privacy and accuracy.

## 7. Activate the public documentation

- [ ] Replace planning language in [the product showcase](product-showcase.md) with the reviewed evidence, captions, captured version, capture date, and supporting links.
- [ ] Replace `PUBLIC_VIDEO_URL` in [the README showcase template](readme-showcase-template.md) with the verified public video URL.
- [ ] Remove the intentional spaces from the inactive Markdown in the template.
- [ ] Insert the activated `See Development Kit in action` section into the root README after `Current release` and before `What you get`.
- [ ] Verify the documentation-home link to this marketing workspace.
- [ ] Verify every image, animation, video, documentation, npm, and GitHub link.
- [ ] Confirm that no placeholder URL, inactive Markdown, broken reference, or `coming soon` claim remains.

## 8. Run the final merge gate

- [ ] Run `npm run release:validate` against the final asset commit.
- [ ] Confirm the entire suite passes.
- [ ] Confirm large master video files are not committed or included in the npm package.
- [ ] Record the final evidence metadata and validation result in the pull request.
- [ ] Request final evidence review.
- [ ] Mark the pull request ready only after all preceding gates pass.
- [ ] Merge only after the evidence, privacy, accuracy, links, and validation results are approved.
