# v012-consumer-smoke.mjs

## Purpose
Verify the **actual npm distribution artifact**, not the checkout tree. The test packs `development-kit@0.12.0` into a temporary directory, performs an offline no-scripts installation, asserts the real consumer package exposes T01–T03/T05–T10 modules, checks Antigravity plugin version, confirms required exports import, and proves no T04 State Engine V2 source is present.

## Usage
```powershell
npm run consumer-smoke:v012
```

The script uses `npm_execpath` from the calling npm process, preserving Windows and Ubuntu compatibility. All temporary resources are outside the repository and removed after testing. It does **not** delete user Contracts or `.development-kit` project records.

## Evidence and safety
A successful exit is a packaging/consumer smoke result, **not** independent release acceptance or evidence that npm was publicly published. Actual npm publication still requires the authorized maintainer release workflow and public registry verification.
