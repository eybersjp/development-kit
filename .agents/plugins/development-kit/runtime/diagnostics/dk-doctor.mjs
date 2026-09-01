import fs from 'node:fs';
import path from 'node:path';

export const DIAGNOSTIC_CLASSES = Object.freeze({
  RUNTIME_DEFECT: 'DKF_RUNTIME_DEFECT',
  PROJECT_DEFECT: 'PROJECT_DEFECT',
  BOOTSTRAP_DEFECT: 'BOOTSTRAP_DEFECT',
  INSTALLER_DEFECT: 'INSTALLER_DEFECT',
  PLUGIN_MIRROR_DEFECT: 'PLUGIN_MIRROR_DEFECT',
  HOST_DEFECT: 'HOST_DEFECT',
  THIRD_PARTY_PLUGIN_DEFECT: 'THIRD_PARTY_PLUGIN_DEFECT',
  ENVIRONMENT_DEFECT: 'ENVIRONMENT_DEFECT',
  UNSUPPORTED_HOST_CAPABILITY: 'UNSUPPORTED_HOST_CAPABILITY',
});

export function runDoctorDiagnostics({ rootDir = process.cwd(), capabilities = {} } = {}) {
  const reports = [];

  // 1. Runtime / Package
  const packagePath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      reports.push({
        domain: 'Development Kit Runtime',
        status: 'PASS',
        version: pkg.version,
      });
    } catch {
      reports.push({
        domain: 'Development Kit Runtime',
        status: 'ERROR',
        class: DIAGNOSTIC_CLASSES.PROJECT_DEFECT,
        message: 'Invalid package.json in project root',
      });
    }
  }

  // 2. Project Bootstrap
  const dkDir = path.join(rootDir, '.development-kit');
  if (fs.existsSync(dkDir)) {
    const projectJson = path.join(dkDir, 'project.json');
    if (fs.existsSync(projectJson)) {
      reports.push({
        domain: 'Project Bootstrap',
        status: 'PASS',
      });
    } else {
      reports.push({
        domain: 'Project Bootstrap',
        status: 'ERROR',
        class: DIAGNOSTIC_CLASSES.BOOTSTRAP_DEFECT,
        message: 'Missing .development-kit/project.json',
      });
    }
  } else {
    reports.push({
      domain: 'Project Bootstrap',
      status: 'WARNING',
      class: DIAGNOSTIC_CLASSES.BOOTSTRAP_DEFECT,
      message: '.development-kit directory not initialized',
    });
  }

  // 3. Plugin Mirror
  const pluginManifest = path.join(rootDir, '.agents', 'plugins', 'development-kit', 'plugin.json');
  if (fs.existsSync(pluginManifest)) {
    reports.push({
      domain: 'Antigravity Plugin Mirror',
      status: 'PASS',
    });
  }

  // 4. Host Capabilities
  if (capabilities.guaranteedMediation === false) {
    reports.push({
      domain: 'Host Capability: Guaranteed Execution Mediation',
      status: 'UNSUPPORTED',
      class: DIAGNOSTIC_CLASSES.UNSUPPORTED_HOST_CAPABILITY,
      message: 'Host environment lacks guaranteed tool interception',
    });
  } else {
    reports.push({
      domain: 'Host Capability: Guaranteed Execution Mediation',
      status: 'PASS',
    });
  }

  const allPassed = reports.every((r) => r.status === 'PASS');

  return {
    success: allPassed,
    reports,
  };
}
