import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const releaseWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'release-command.yml'), 'utf8');

test('maintainer release workflow performs publication directly after validated tag creation', () => {
  assert.match(releaseWorkflow, /^\s*publish:\s*$/m, 'release workflow must contain a publish job');
  assert.match(releaseWorkflow, /^\s*needs:\s*release\s*$/m, 'publish job must depend on validated release job');
  assert.match(releaseWorkflow, /^\s*environment:\s*npm\s*$/m, 'npm publication must remain protected by the npm environment');
  assert.match(releaseWorkflow, /Create or verify GitHub Release/, 'workflow must create or verify the GitHub Release itself');
  assert.match(releaseWorkflow, /npm publish --access public/, 'workflow must publish the npm package itself when needed');
  assert.match(releaseWorkflow, /npm view \"\$PACKAGE_NAME@\$PACKAGE_VERSION\" version/, 'workflow must detect or verify exact npm version state');
  assert.doesNotMatch(
    releaseWorkflow,
    /trigger the canonical [`']?publish\.yml|pushed to trigger/i,
    'maintainer release workflow must not rely on a GITHUB_TOKEN tag push to trigger another workflow',
  );
});

test('maintainer release workflow is retry-safe for existing tags and public artifacts', () => {
  assert.match(releaseWorkflow, /tag_exists=true/, 'workflow must detect existing tags');
  assert.match(releaseWorkflow, /Verify existing release tag/, 'workflow must verify an existing release tag');
  assert.match(releaseWorkflow, /gh release view \"\$TAG\"/, 'workflow must detect an existing GitHub Release');
  assert.match(releaseWorkflow, /published=true/, 'workflow must detect an already-published npm version');
  assert.match(releaseWorkflow, /status=already-published/, 'workflow must report already-published npm state');
});
