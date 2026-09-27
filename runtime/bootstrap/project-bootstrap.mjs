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
import { getDefaultModeConfiguration, resolveDevelopmentModeConfiguration } from '../development-modes/policy-contract.mjs';
import { initializeDevelopmentMode, inspectDevelopmentMode } from '../development-modes/config-store.mjs';

export function getProjectBootstrapStatus(rootDir = process.cwd()) {
  const dkDir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dkDir)) {
    return { initialized: false, dkDirExists: false, modeConfigurationStatus: 'absent' };
  }

  const projectFile = path.join(dkDir, 'project.json');
  const workspaceFile = path.join(dkDir, 'workspace-id');
  const memoryManifest = path.join(dkDir, 'intelligence', 'memory', 'manifest.json');

  const initialized = fs.existsSync(projectFile) && fs.existsSync(workspaceFile);
  let modeConfigurationStatus = 'absent';
  let modeRevision = null;
  let modeError = null;
  try {
    const modeState = inspectDevelopmentMode(rootDir);
    modeConfigurationStatus = modeState.status;
    modeRevision = modeState.revision ?? null;
  } catch (error) {
    modeConfigurationStatus = 'invalid';
    modeError = error.message;
  }
  return {
    initialized,
    dkDirExists: true,
    hasProjectJson: fs.existsSync(projectFile),
    hasWorkspaceId: fs.existsSync(workspaceFile),
    hasMemoryManifest: fs.existsSync(memoryManifest),
    modeConfigurationStatus,
    modeRevision,
    ...(modeError ? { modeError } : {})
  };
}

export async function bootstrapProject(rootDir = process.cwd(), options = {}) {
  try {
    // Validate before mutating existing project state.
    if (options.modeConfig !== undefined) resolveDevelopmentModeConfiguration(options.modeConfig);
    const previousStatus = getProjectBootstrapStatus(rootDir);
    if (previousStatus.modeConfigurationStatus === 'invalid') {
      throw new Error(`Existing Development Modes configuration is invalid: ${previousStatus.modeError}`);
    }
    const existingMode = inspectDevelopmentMode(rootDir);
    const requestedMode = options.modeConfig ?? existingMode.selection ?? getDefaultModeConfiguration();
    const modeSource = options.modeConfig ? 'explicit'
      : previousStatus.initialized ? 'legacy-migration' : 'default';

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

    // 3. Persist repository-owned methodology without replacing existing selections.
    const developmentMode = initializeDevelopmentMode(rootDir, requestedMode, {
      source: modeSource,
      actor: options.modeConfig ? 'developer-bootstrap' : 'dk-bootstrap',
      reason: previousStatus.initialized ? 'Existing DKF project methodology recorded' : 'Initial project methodology recorded',
    });

    // 4. Establish autopilot state directory (.development-kit/autopilot/state/)
    const autopilotStateDir = path.join(dkDir, 'autopilot', 'state');
    if (!fs.existsSync(autopilotStateDir)) {
      fs.mkdirSync(autopilotStateDir, { recursive: true });
    }

    // 5. Establish memory provider storage & index (.development-kit/intelligence/memory/)
    const memoryProvider = new LocalMemoryProvider({ rootDir });
    await memoryProvider.activate();

    const effectiveSettings = resolveEffectiveSettings(rootDir);

    return {
      success: true,
      initialized: true,
      rootDir,
      identity,
      settings: effectiveSettings,
      developmentMode
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

export class BootstrapError extends Error {
  constructor(message, code = 'DK_BOOTSTRAP_FAILED', details = null) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
    this.details = details;
  }
}

export function assertProjectBootstrapped(rootDir = process.cwd(), { requireMutatingState = true } = {}) {
  const dkDir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dkDir) || !fs.statSync(dkDir).isDirectory()) {
    throw new BootstrapError('Project root lacks .development-kit directory', 'DK_BOOTSTRAP_MISSING');
  }

  const projectFile = path.join(dkDir, 'project.json');
  const workspaceFile = path.join(dkDir, 'workspace-id');

  if (!fs.existsSync(projectFile) || !fs.existsSync(workspaceFile)) {
    throw new BootstrapError('Project identity or workspace identity is missing', 'DK_BOOTSTRAP_CORRUPT');
  }

  let projectData;
  try {
    projectData = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  } catch (err) {
    throw new BootstrapError(`Corrupt project.json: ${err.message}`, 'DK_BOOTSTRAP_CORRUPT');
  }

  if (!projectData.projectId || !projectData.frameworkVersion) {
    throw new BootstrapError('project.json missing mandatory projectId or frameworkVersion', 'DK_BOOTSTRAP_CORRUPT');
  }

  if (requireMutatingState) {
    const contractsDir = path.join(dkDir, 'contracts');
    const runsDir = path.join(dkDir, 'runs');
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });
    if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
  }

  return {
    bootstrapped: true,
    projectId: projectData.projectId,
    frameworkVersion: projectData.frameworkVersion,
  };
}

