/**
 * Development Kit — Project Bootstrapper & Local State Initializer
 *
 * Ensures idempotent establishment of required project-local runtime state under
 * `.development-kit/`, including the repository-owned Development Mode selection.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getProjectIdentity } from '../autopilot/project-identity.mjs';
import { LocalMemoryProvider } from '../intelligence/local-memory-provider.mjs';
import { resolveEffectiveSettings, getProjectSettingsPath, DEFAULT_SETTINGS } from '../intelligence/settings.mjs';
import { bootstrapGit, inspectGitState } from './git-bootstrap.mjs';
import {
  getDefaultModeConfiguration,
  resolveDevelopmentModeConfiguration,
} from '../development-modes/policy-contract.mjs';
import {
  initializeDevelopmentMode,
  inspectDevelopmentMode,
} from '../development-modes/config-store.mjs';

export function getProjectBootstrapStatus(rootDir = process.cwd()) {
  const dkDir = path.join(rootDir, '.development-kit');
  const gitState = inspectGitState(rootDir);

  if (!fs.existsSync(dkDir)) {
    return {
      initialized: false,
      dkDirExists: false,
      modeConfigurationStatus: 'absent',
      modeRevision: null,
      git: gitState,
    };
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
    ...(modeError ? { modeError } : {}),
    git: gitState,
  };
}

export async function bootstrapProject(rootDir = process.cwd(), options = {}) {
  try {
    // Validate explicit mode input before creating or mutating project state.
    if (options.modeConfig !== undefined) {
      resolveDevelopmentModeConfiguration(options.modeConfig);
    }

    const previousStatus = getProjectBootstrapStatus(rootDir);
    if (previousStatus.modeConfigurationStatus === 'invalid') {
      throw new Error(`Existing Development Modes configuration is invalid: ${previousStatus.modeError}`);
    }

    const existingMode = inspectDevelopmentMode(rootDir);
    const requestedMode = options.modeConfig ?? existingMode.selection ?? getDefaultModeConfiguration();
    const modeSource = options.modeConfig
      ? 'explicit'
      : previousStatus.initialized
        ? 'legacy-migration'
        : 'default';

    const dkDir = path.join(rootDir, '.development-kit');
    if (!fs.existsSync(dkDir)) {
      fs.mkdirSync(dkDir, { recursive: true });
    }

    // 1. Establish project & workspace identity.
    const identity = getProjectIdentity(rootDir);

    // 2. Establish project settings if absent.
    const settingsPath = getProjectSettingsPath(rootDir);
    if (!fs.existsSync(settingsPath)) {
      const initialSettings = {
        controlCenter: {
          autoOpen: DEFAULT_SETTINGS.controlCenter.autoOpen,
          port: DEFAULT_SETTINGS.controlCenter.port,
          host: DEFAULT_SETTINGS.controlCenter.host,
        },
        intelligence: {
          defaultProvider: DEFAULT_SETTINGS.intelligence.defaultProvider,
          contextBudgetTokens: DEFAULT_SETTINGS.intelligence.contextBudgetTokens,
        },
      };
      fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2), 'utf8');
    }

    // 3. Persist repository-owned methodology. Existing selections are preserved.
    const developmentMode = initializeDevelopmentMode(rootDir, requestedMode, {
      source: modeSource,
      actor: options.modeConfig ? 'developer-bootstrap' : 'dk-bootstrap',
      reason: previousStatus.initialized
        ? 'Existing DKF project methodology recorded'
        : 'Initial project methodology recorded',
    });

    // 4. Establish Autopilot state directory.
    const autopilotStateDir = path.join(dkDir, 'autopilot', 'state');
    if (!fs.existsSync(autopilotStateDir)) {
      fs.mkdirSync(autopilotStateDir, { recursive: true });
    }

    // 5. Establish memory provider storage & index.
    const memoryProvider = new LocalMemoryProvider({ rootDir });
    await memoryProvider.activate();

    // 6. Bootstrap Git and reconcile .gitignore using the current v0.11 behavior.
    const git = bootstrapGit(rootDir, options);

    const effectiveSettings = resolveEffectiveSettings(rootDir);

    return {
      success: true,
      initialized: true,
      rootDir,
      identity,
      git,
      settings: effectiveSettings,
      developmentMode,
    };
  } catch (err) {
    return {
      success: false,
      initialized: false,
      error: err.message,
      code: err.code ?? 'ERROR_BOOTSTRAP_FAILED',
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

  const modeState = inspectDevelopmentMode(rootDir);
  if (modeState.status !== 'configured') {
    throw new BootstrapError('Project Development Mode is not configured', 'DK_MODE_BOOTSTRAP_MISSING');
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
    developmentMode: {
      revision: modeState.revision,
      mode: modeState.resolved.mode,
      baseMethodology: modeState.resolved.baseMethodology,
    },
  };
}
