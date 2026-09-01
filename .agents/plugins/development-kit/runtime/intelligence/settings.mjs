/**
 * Development Kit — Scoped Settings Schema & Resolver
 *
 * Implements hierarchical resolution for Development Kit settings (e.g. controlCenter.autoOpen):
 * Project Override (.development-kit/settings.json)
 *   → Global/User Preferences (~/.gemini/config/development-kit-settings.json)
 *   → Hard Defaults (autoOpen: false)
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SETTINGS = Object.freeze({
  controlCenter: Object.freeze({
    autoOpen: false,
    port: 3200,
    host: '127.0.0.1',
  }),
  intelligence: Object.freeze({
    defaultProvider: 'local',
    contextBudgetTokens: 2000,
  }),
});

/**
 * Validates settings object.
 */
export function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Settings must be a non-null object');
  }

  if (settings.controlCenter !== undefined && settings.controlCenter !== null) {
    if (typeof settings.controlCenter !== 'object' || Array.isArray(settings.controlCenter)) {
      throw new Error('controlCenter settings must be an object');
    }

    if (
      settings.controlCenter.autoOpen !== undefined &&
      typeof settings.controlCenter.autoOpen !== 'boolean'
    ) {
      throw new Error('controlCenter.autoOpen must be a boolean');
    }

    if (
      settings.controlCenter.port !== undefined &&
      (!Number.isInteger(settings.controlCenter.port) || settings.controlCenter.port < 1024 || settings.controlCenter.port > 65535)
    ) {
      throw new Error('controlCenter.port must be a valid port integer (1024-65535)');
    }

    if (
      settings.controlCenter.host !== undefined &&
      typeof settings.controlCenter.host !== 'string'
    ) {
      throw new Error('controlCenter.host must be a string');
    }
  }

  return true;
}

/**
 * Reads settings from a JSON file safely.
 */
function readSettingsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    validateSettings(parsed);
    return parsed;
  } catch (err) {
    // Malformed settings file returns null for safe fallback
    return null;
  }
}

/**
 * Gets the global settings filepath.
 */
export function getGlobalSettingsPath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
  return path.join(homeDir, '.gemini', 'config', 'development-kit-settings.json');
}

/**
 * Gets the project settings filepath.
 */
export function getProjectSettingsPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'settings.json');
}

/**
 * Resolves the effective settings for the project workspace:
 * Project override -> Global preference -> Default
 */
export function resolveEffectiveSettings(rootDir = process.cwd(), customGlobalPath = null) {
  const globalPath = customGlobalPath || getGlobalSettingsPath();
  const projectPath = getProjectSettingsPath(rootDir);

  const globalSettings = readSettingsFile(globalPath) || {};
  const projectSettings = readSettingsFile(projectPath) || {};

  const effective = {
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

  // Apply Global
  if (globalSettings.controlCenter) {
    if (typeof globalSettings.controlCenter.autoOpen === 'boolean') {
      effective.controlCenter.autoOpen = globalSettings.controlCenter.autoOpen;
    }
    if (globalSettings.controlCenter.port) {
      effective.controlCenter.port = globalSettings.controlCenter.port;
    }
    if (globalSettings.controlCenter.host) {
      effective.controlCenter.host = globalSettings.controlCenter.host;
    }
  }
  if (globalSettings.intelligence) {
    if (globalSettings.intelligence.defaultProvider) {
      effective.intelligence.defaultProvider = globalSettings.intelligence.defaultProvider;
    }
    if (globalSettings.intelligence.contextBudgetTokens) {
      effective.intelligence.contextBudgetTokens = globalSettings.intelligence.contextBudgetTokens;
    }
  }

  // Apply Project Override (beats Global)
  if (projectSettings.controlCenter) {
    if (typeof projectSettings.controlCenter.autoOpen === 'boolean') {
      effective.controlCenter.autoOpen = projectSettings.controlCenter.autoOpen;
    }
    if (projectSettings.controlCenter.port) {
      effective.controlCenter.port = projectSettings.controlCenter.port;
    }
    if (projectSettings.controlCenter.host) {
      effective.controlCenter.host = projectSettings.controlCenter.host;
    }
  }
  if (projectSettings.intelligence) {
    if (projectSettings.intelligence.defaultProvider) {
      effective.intelligence.defaultProvider = projectSettings.intelligence.defaultProvider;
    }
    if (projectSettings.intelligence.contextBudgetTokens) {
      effective.intelligence.contextBudgetTokens = projectSettings.intelligence.contextBudgetTokens;
    }
  }

  return effective;
}
