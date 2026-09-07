# Recording and Privacy Checklist

Complete this checklist before publishing any Development Kit screenshot or video.

## Environment

- [ ] The recording uses a dedicated public demo workspace.
- [ ] Development Kit and the host environment versions are known.
- [ ] The workspace contains no customer, employer, or confidential project data.
- [ ] Notifications are disabled.
- [ ] Browser bookmarks, account menus, avatars, unrelated tabs, and private repositories are hidden.
- [ ] Terminal history and environment variables have been reviewed.
- [ ] No password manager, API key, token, email address, phone number, or private URL appears on screen.
- [ ] File paths do not reveal unnecessary personal information.

## Product accuracy

- [ ] The demonstrated command exists in the current public release.
- [ ] The displayed output comes from real execution.
- [ ] The workflow follows the documented lifecycle.
- [ ] Approval gates are shown accurately and are not bypassed for presentation.
- [ ] Captions describe only what the visible evidence supports.
- [ ] Any accelerated or shortened sequence is disclosed.
- [ ] Version numbers are visible or stated in the description.

## Visual quality

- [ ] Text remains readable at normal playback size.
- [ ] The capture uses a consistent 16:9 frame.
- [ ] Cursor movement is controlled.
- [ ] Dead time and repeated typing are removed.
- [ ] Cropping does not hide a relevant warning or failed step.
- [ ] Screenshots use concise alt text.
- [ ] Videos include captions and a transcript.
- [ ] Audio levels are consistent and narration is intelligible.

## Publication

- [ ] Canonical filenames follow `media/README.md`.
- [ ] The source date and Development Kit version are recorded in the pull request.
- [ ] The full video URL is stable and publicly accessible.
- [ ] The README thumbnail opens the intended video.
- [ ] Repository and documentation links have been validated.
- [ ] `npm run release:validate` passes before merge.
- [ ] A second person or separate review pass has checked for privacy and accuracy issues.
