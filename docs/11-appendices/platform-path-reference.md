# Platform Path Reference

Path resolution guidelines across Windows, macOS, and Linux host environments.

## Platform Differences

- **Windows**: Uses backslashes (`\`) for file system paths, drive letters (`C:\`), and PowerShell execution defaults.
- **POSIX (macOS / Linux)**: Uses forward slashes (`/`), root-relative paths (`/usr/local`), and bash execution defaults.

## Framework Invariant

All Markdown documentation, relative links, and script paths MUST use POSIX forward slash conventions (`/`) for universal compatibility across host environments.

## Related Documentation

- [File Location Reference](file-location-reference.md)
- [Compatibility Guidelines](../05-developer-guide/compatibility-guidelines.md)
