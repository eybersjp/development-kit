# Framework Boundaries

While Development Kit provides powerful engineering automation, it operates within strict design boundaries:

## Explicit Boundaries

* **No Unassisted Code Generation**: Development Kit will not jump straight to coding without first conducting discovery (`/dk-idea`), specification (`/dk-spec`), or task planning (`/dk-tasks`) for non-trivial requests.
* **No Direct Mirrored File Editing**: Agents and developers must never edit `.agents/plugins/development-kit/` files directly. Modifications must occur in canonical root folders (`skills/`, `agents/`, `commands/`, `hooks/`) and synced via `node scripts/sync-plugin.mjs`.
* **No Automatic Branch Merging / Publishing**: Development Kit prepares branches (`/dk-ship`) but will never push commits to remotes, merge PRs, or publish packages to registries without explicit human instructions.
* **No Elimination of Safety Exclusions**: Simplification reviews will never suggest removing security checks, error boundaries, input sanitization, or test suites.

## When NOT to Use Development Kit

* **Trivial One-Line Edits**: Fixing a simple typo or syntax error in a single file does not require running full specification cycles.
* **Purely Investigatory Queries**: Explaining how a function works or listing directory contents does not warrant task plans or sub-agent dispatch.
