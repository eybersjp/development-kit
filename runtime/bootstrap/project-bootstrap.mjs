/**
 * Development Kit — Project Bootstrapper & Local State Initializer
 *
 * Ensures idempotent establishment of the required project-local runtime state
 * under `.development-kit/` before lifecycle commands record or report state.
 *
 * Established layout:
 * - `.development-kit/project.json` (Project identity & framework version)
 * - `.development-kit/workspace-id` (Local workspace identity)
 * - `.development-kit/settings.json` (Project settings root)
 * - `.development-kit/autopilot/state/` (Autopilot revision state store)
 * - `.development-kit/intelligence/memory/records/` (Local memory store)
 * - `.development-kit/intelligence/memory/manifest.json`
 * - `.development-kit/intelligence/memory/index.json`
 */

import fs from 'node:fs';
import path from 'node:path';
import { getProjectIdentity } from '../autopilot/project-identity.mjs';
import { LocalMemoryProvider } from '../intelligence/local-memory-provider.mjs';
import { resolveEffectiveSettings, getProjectSettingsPath, DEFAULT_SETTINGS } from '../intelligence/settings.mjs';

export function getProjectBootstrapStatus(rootDir = process.cwd()) {
  const dkDir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dkDir)) {
    return { initialized: false, dkDirExists: false };
  }

  const projectFile = path.join(dkDir, 'project.json');
  const workspaceFile = path.join(dkDir, 'workspace-id');
  const memoryManifest = path.join(dkDir, 'intelligence', 'memory', 'manifest.json');

  const initialized = fs.existsSync(projectFile) && fs.existsSync(workspaceFile);
  return {
    initialized,
    dkDirExists: true,
    hasProjectJson: fs.existsSync(projectFile),
    hasWorkspaceId: fs.existsSync(workspaceFile),
    hasMemoryManifest: fs.existsSync(memoryManifest)
  };
}

export async function bootstrapProject(rootDir = process.cwd(), options = {}) {
  try {
    const dkDir = path.join(rootDir, '.development-kit');
    if (!fs.existsSync(dkDir)) {
      fs.mkdirSync(dkDir, { recursive: true });
    }

    // 1. Establish project & workspace identity (.development-kit/project.json & workspace-id)
    const identity = getProjectIdentity(rootDir);

    // 2. Establish project settings if not existing (.development-kit/settings.json)
    const settingsPath = getProjectSettingsPath(rootDir);
    if (!fs.existsSync(settingsPath)) {
      const initialSettings = {
        controlCenter: {
          autoOpen: DEFAULT_SETTINGS.controlCenter.autoOpen,
          port: DEFAULT_SETTINGS.controlCenter.port,
          host: DEFAULT_SETTINGS.controlCenter.host
        },
        intelligence: {
          defaultProvider: DEFAULT_SETTINGS.intelligence.defaultProvider,
          contextBudgetTokens: DEFAULT_SETTINGS.intelligence.contextBudgetTokens
        }
      };
      fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2), 'utf8');
    }

    // 3. Establish autopilot state directory (.development-kit/autopilot/state/)
    const autopilotStateDir = path.join(dkDir, 'autopilot', 'state');
    if (!fs.existsSync(autopilotStateDir)) {
      fs.mkdirSync(autopilotStateDir, { recursive: true });
    }

    // 4. Establish memory provider storage & index (.development-kit/intelligence/memory/)
    const memoryProvider = new LocalMemoryProvider({ rootDir });
    await memoryProvider.activate();

    const effectiveSettings = resolveEffectiveSettings(rootDir);

    return {
      success: true,
      initialized: true,
      rootDir,
      identity,
      settings: effectiveSettings
    };
  } catch (err) {
    return {
      success: false,
      initialized: false,
      error: err.message,
      code: 'ERROR_BOOTSTRAP_FAILED'
    };
  }
}
