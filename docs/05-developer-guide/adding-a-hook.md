# Adding a Hook

## Canonical Location

`hooks/<event-name>.js` (CommonJS).

## Naming Rules

- `<event>.js` matching the lifecycle event (existing: `session-start`, `before-task`, `after-task`, `before-completion`).

## Required Structure

- Header comment describing the trigger point and responsibilities.
- Export the hook logic as plain functions/objects (`module.exports = { ... }`).
- **No side effects at load time** — hooks are pure CommonJS modules.

## Registration & Discovery

1. The hook must be listed in `plugin.json` — run `node scripts/sync-plugin.mjs`.
2. The Antigravity runtime invokes hooks by convention from the plugin's `hooks/` directory.

## Required Docs

- `docs/03-reference/hooks/<name>.md` — trigger point, inputs, outputs, side effects, environment assumptions, exit behavior, blocking behavior, failure handling, security considerations, lifecycle relationship, maintenance notes.
- Update `docs/03-reference/hooks/README.md` and `docs/SUMMARY.md`.

## Required Validation

- `npm run validate` (the plugin-manifest hook reference is validated via `validate-skills.mjs`'s manifest check)
- `npm run doctor` — manifest lists 4 hooks; adding one changes the count
- `npm run docs:validate`

## Example (Based on an Existing Hook)

`hooks/before-task.js` exports `validateTaskReadiness` and `selectSkillsForTask`; the header comment documents trigger and responsibilities.

## Common Mistakes

- Side effects at load time (breaks hook runtime assumptions).
- Not adding the hook to the manifest (doctor reports it missing).
- No docs page (docs validator fails).

## Completion Checklist

- [ ] `hooks/<name>.js` created (pure, side-effect-free)
- [ ] Manifest regenerated
- [ ] Reference page + README updated
- [ ] All three validators pass
