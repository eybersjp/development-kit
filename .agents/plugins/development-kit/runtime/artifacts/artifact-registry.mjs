/**
 * Development Kit — Project-Local Authoritative Artifact Registry
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadDiscoveryState } from '../orchestration/idea-discovery.mjs';

export const ARTIFACT_REGISTRY_SCHEMA_VERSION = '1.0.0';

export class ArtifactRegistryError extends Error {
  constructor(message, code = 'DK_ARTIFACT_ERROR', details = null) {
    super(message);
    this.name = 'ArtifactRegistryError';
    this.code = code;
    this.details = details;
  }
}

export function computeSha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function getRegistryPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'artifacts.json');
}

export function validateArtifactRegistryStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new ArtifactRegistryError('Registry must be an object', 'DK_ARTIFACT_REGISTRY_CORRUPT');
  }
  if (data.schemaVersion !== ARTIFACT_REGISTRY_SCHEMA_VERSION) {
    throw new ArtifactRegistryError(`Invalid registry schemaVersion: ${data.schemaVersion}`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
  }
  if (!data.artifacts || typeof data.artifacts !== 'object' || Array.isArray(data.artifacts)) {
    throw new ArtifactRegistryError('Registry artifacts must be an object map', 'DK_ARTIFACT_REGISTRY_CORRUPT');
  }

  for (const [key, item] of Object.entries(data.artifacts)) {
    if (!item || typeof item !== 'object') {
      throw new ArtifactRegistryError(`Registry artifact ${key} must be an object`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
    }
    if (!item.canonicalPath || typeof item.canonicalPath !== 'string') {
      throw new ArtifactRegistryError(`Registry artifact ${key} missing canonicalPath`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
    }
    const rel = item.canonicalPath;
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new ArtifactRegistryError(`Registry artifact ${key} path escapes root: ${rel}`, 'DK_ARTIFACT_PATH_ESCAPE');
    }
    if (key === 'IDEA_BRIEF') {
      if (rel !== 'idea-brief.md') {
        throw new ArtifactRegistryError(`IDEA_BRIEF canonicalPath must be idea-brief.md (got ${rel})`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
      }
      if (item.artifactType !== 'idea-brief') {
        throw new ArtifactRegistryError(`IDEA_BRIEF artifactType must be 'idea-brief' (got ${item.artifactType})`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
      }
      if (item.lifecycleStage !== 'UNDERSTAND') {
        throw new ArtifactRegistryError(`IDEA_BRIEF lifecycleStage must be 'UNDERSTAND' (got ${item.lifecycleStage})`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
      }
    }
    if (!item.fingerprint || !/^sha256:[a-f0-9]{64}$/i.test(item.fingerprint)) {
      throw new ArtifactRegistryError(`Registry artifact ${key} invalid fingerprint (must be sha256:<64 hex>)`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
    }
    if (typeof item.revision !== 'number' || !Number.isInteger(item.revision) || item.revision <= 0) {
      throw new ArtifactRegistryError(`Registry artifact ${key} invalid revision`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
    }
    if (item.discoveryRevision !== null && item.discoveryRevision !== undefined) {
      if (typeof item.discoveryRevision !== 'number' || !Number.isInteger(item.discoveryRevision) || item.discoveryRevision < 0) {
        throw new ArtifactRegistryError(`Registry artifact ${key} invalid discoveryRevision`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
      }
    }
    if (item.discoveryFingerprint !== null && item.discoveryFingerprint !== undefined) {
      if (!/^sha256:[a-f0-9]{64}$/i.test(item.discoveryFingerprint)) {
        throw new ArtifactRegistryError(`Registry artifact ${key} invalid discoveryFingerprint`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
      }
    }
  }
  return true;
}

export function loadArtifactRegistry(rootDir = process.cwd()) {
  const regPath = getRegistryPath(rootDir);
  if (!fs.existsSync(regPath)) {
    return {
      schemaVersion: ARTIFACT_REGISTRY_SCHEMA_VERSION,
      artifacts: {},
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    validateArtifactRegistryStructure(data);
    return data;
  } catch (err) {
    if (err instanceof ArtifactRegistryError) throw err;
    throw new ArtifactRegistryError(`Corrupt artifact registry: ${err.message}`, 'DK_ARTIFACT_REGISTRY_CORRUPT');
  }
}

export function persistArtifactRegistry(registry, rootDir = process.cwd()) {
  const dkDir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dkDir)) {
    fs.mkdirSync(dkDir, { recursive: true });
  }
  const regPath = getRegistryPath(rootDir);
  const tempPath = `${regPath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, regPath);
}

export function resolveCanonicalIdeaArtifact(rootDir = process.cwd(), { verifyFingerprint = false } = {}) {
  const registry = loadArtifactRegistry(rootDir);
  const rootPath = path.join(rootDir, 'idea-brief.md');
  const legacyPath = path.join(rootDir, 'docs', 'idea-brief.md');

  const rootExists = fs.existsSync(rootPath) && fs.statSync(rootPath).isFile();
  const legacyExists = fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile();

  if (registry.artifacts.IDEA_BRIEF) {
    const regRecord = registry.artifacts.IDEA_BRIEF;
    const regRel = regRecord.canonicalPath;
    const regAbs = path.resolve(rootDir, regRel);

    const relFromRoot = path.relative(rootDir, regAbs);
    if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
      throw new ArtifactRegistryError('Registered artifact path escapes project root', 'DK_ARTIFACT_PATH_ESCAPE');
    }

    if (!fs.existsSync(regAbs)) {
      throw new ArtifactRegistryError(
        `Registered canonical artifact file is missing: ${regRel}`,
        'DK_ARTIFACT_MISSING',
        { canonicalPath: regRel, registeredFingerprint: regRecord.fingerprint }
      );
    }

    if (regRel === 'idea-brief.md' && legacyExists) {
      const rootContent = fs.readFileSync(rootPath, 'utf8');
      const legacyContent = fs.readFileSync(legacyPath, 'utf8');
      const rootFp = computeSha256(rootContent);
      const legFp = computeSha256(legacyContent);
      if (rootFp !== legFp) {
        throw new ArtifactRegistryError(
          'Both idea-brief.md and docs/idea-brief.md exist with differing contents',
          'DK_ARTIFACT_AUTHORITY_CONFLICT',
          { rootFp, legFp }
        );
      }
    }

    const actualContent = fs.readFileSync(regAbs, 'utf8');
    const actualFp = computeSha256(actualContent);

    if (verifyFingerprint && actualFp !== regRecord.fingerprint) {
      throw new ArtifactRegistryError(
        'Physical file fingerprint does not match registered artifact fingerprint',
        'DK_ARTIFACT_FINGERPRINT_MISMATCH',
        { registeredFingerprint: regRecord.fingerprint, actualFingerprint: actualFp }
      );
    }

    return {
      relativePath: regRel,
      absolutePath: regAbs,
      fingerprint: regRecord.fingerprint,
      actualFingerprint: actualFp,
      isFingerprintMismatch: actualFp !== regRecord.fingerprint,
      revision: regRecord.revision || 1,
      discoveryRevision: regRecord.discoveryRevision ?? null,
      discoveryFingerprint: regRecord.discoveryFingerprint ?? null,
      registered: true,
      condition: null,
    };
  }

  // Pure read-only resolution when artifact is not yet registered
  if (rootExists && legacyExists) {
    const rootContent = fs.readFileSync(rootPath, 'utf8');
    const legacyContent = fs.readFileSync(legacyPath, 'utf8');
    const rootFp = computeSha256(rootContent);
    const legFp = computeSha256(legacyContent);

    if (rootFp !== legFp) {
      throw new ArtifactRegistryError(
        'Both idea-brief.md and docs/idea-brief.md exist with differing contents',
        'DK_ARTIFACT_AUTHORITY_CONFLICT',
        { rootFp, legFp }
      );
    }

    return {
      relativePath: 'idea-brief.md',
      absolutePath: rootPath,
      fingerprint: rootFp,
      actualFingerprint: rootFp,
      isFingerprintMismatch: false,
      revision: 0,
      discoveryRevision: null,
      discoveryFingerprint: null,
      registered: false,
      condition: 'IDENTICAL_DUPLICATE_DETECTED',
    };
  }

  if (rootExists) {
    const content = fs.readFileSync(rootPath, 'utf8');
    const fp = computeSha256(content);
    return {
      relativePath: 'idea-brief.md',
      absolutePath: rootPath,
      fingerprint: fp,
      actualFingerprint: fp,
      isFingerprintMismatch: false,
      revision: 0,
      discoveryRevision: null,
      discoveryFingerprint: null,
      registered: false,
      condition: 'UNREGISTERED_CANONICAL_ARTIFACT',
    };
  }

  if (legacyExists) {
    const content = fs.readFileSync(legacyPath, 'utf8');
    const fp = computeSha256(content);
    return {
      relativePath: 'docs/idea-brief.md',
      absolutePath: legacyPath,
      fingerprint: fp,
      actualFingerprint: fp,
      isFingerprintMismatch: false,
      revision: 0,
      discoveryRevision: null,
      discoveryFingerprint: null,
      registered: false,
      condition: 'LEGACY_ARTIFACT_DETECTED',
    };
  }

  return {
    relativePath: 'idea-brief.md',
    absolutePath: rootPath,
    fingerprint: null,
    actualFingerprint: null,
    isFingerprintMismatch: false,
    revision: 0,
    discoveryRevision: null,
    discoveryFingerprint: null,
    registered: false,
    condition: 'MISSING',
  };
}

export function registerArtifact({
  rootDir = process.cwd(),
  key,
  canonicalPath,
  artifactType,
  lifecycleStage,
  fingerprint,
  revision = 1,
  discoveryRevision = null,
  discoveryFingerprint = null,
}) {
  // IDEA_BRIEF can never be registered through the public API.
  // Any extra properties (e.g. _allowDirectIdeaBrief) are silently ignored
  // and the guard below always fires.
  if (key === 'IDEA_BRIEF') {
    throw new ArtifactRegistryError(
      'Direct registration of IDEA_BRIEF is prohibited. Use persistCanonicalIdeaBrief or reconcileCanonicalIdeaBrief.',
      'DK_RAW_REGISTRATION_PROHIBITED'
    );
  }

  const registry = loadArtifactRegistry(rootDir);
  registry.artifacts[key] = {
    canonicalPath,
    fingerprint,
    artifactType,
    lifecycleStage,
    revision,
    discoveryRevision,
    discoveryFingerprint,
    updatedAt: new Date().toISOString(),
  };
  persistArtifactRegistry(registry, rootDir);
  return registry.artifacts[key];
}

/**
 * Module-private IDEA_BRIEF registration helper.
 * NOT exported. Only persistCanonicalIdeaBrief and reconcileCanonicalIdeaBrief may call this.
 */
function _registerIdeaBriefInternal({
  rootDir = process.cwd(),
  canonicalPath,
  fingerprint,
  revision,
  discoveryRevision = null,
  discoveryFingerprint = null,
}) {
  // Validate that discovery bindings correspond to actual loaded discovery state
  const disc = loadDiscoveryState(rootDir);
  if (discoveryRevision !== null && discoveryRevision !== undefined) {
    if (discoveryRevision !== disc.revision || discoveryFingerprint !== disc.fingerprint) {
      throw new ArtifactRegistryError(
        `Fabricated discovery binding rejected for IDEA_BRIEF (provided rev: ${discoveryRevision}, current disc rev: ${disc.revision})`,
        'DK_DISCOVERY_BINDING_MISMATCH'
      );
    }
  }

  const registry = loadArtifactRegistry(rootDir);
  registry.artifacts['IDEA_BRIEF'] = {
    canonicalPath,
    fingerprint,
    artifactType: 'idea-brief',
    lifecycleStage: 'UNDERSTAND',
    revision,
    discoveryRevision,
    discoveryFingerprint,
    updatedAt: new Date().toISOString(),
  };
  persistArtifactRegistry(registry, rootDir);
  return registry.artifacts['IDEA_BRIEF'];
}

export function persistCanonicalIdeaBrief({
  rootDir = process.cwd(),
  content,
}) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new ArtifactRegistryError('Content must be a non-empty string', 'DK_ARTIFACT_INVALID_CONTENT');
  }

  // Authoritatively load and validate current discovery state.
  // Must fail closed if discovery state is missing or corrupt.
  const disc = loadDiscoveryState(rootDir);
  const finalDiscRev = disc.revision;
  const finalDiscFp = disc.fingerprint;

  const resolved = resolveCanonicalIdeaArtifact(rootDir, { verifyFingerprint: false });
  const targetAbs = path.resolve(rootDir, 'idea-brief.md');
  const tempPath = `${targetAbs}.tmp.${Date.now()}.${process.pid}`;

  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, targetAbs);

  const fingerprint = computeSha256(content);
  const newRevision = (resolved.registered && resolved.revision) ? resolved.revision + 1 : 1;

  const record = _registerIdeaBriefInternal({
    rootDir,
    canonicalPath: 'idea-brief.md',
    fingerprint,
    revision: newRevision,
    discoveryRevision: finalDiscRev,
    discoveryFingerprint: finalDiscFp,
  });

  return {
    success: true,
    canonicalPath: 'idea-brief.md',
    absolutePath: targetAbs,
    fingerprint,
    revision: newRevision,
    discoveryRevision: finalDiscRev,
    discoveryFingerprint: finalDiscFp,
    record,
  };
}

export function reconcileCanonicalIdeaBrief({
  rootDir = process.cwd(),
} = {}) {
  const rootPath = path.join(rootDir, 'idea-brief.md');
  const legacyPath = path.join(rootDir, 'docs', 'idea-brief.md');
  const rootExists = fs.existsSync(rootPath) && fs.statSync(rootPath).isFile();
  const legacyExists = fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile();

  if (rootExists && legacyExists) {
    const rootContent = fs.readFileSync(rootPath, 'utf8');
    const legacyContent = fs.readFileSync(legacyPath, 'utf8');
    const rootFp = computeSha256(rootContent);
    const legFp = computeSha256(legacyContent);
    if (rootFp !== legFp) {
      throw new ArtifactRegistryError(
        'Both idea-brief.md and docs/idea-brief.md exist with differing contents',
        'DK_ARTIFACT_AUTHORITY_CONFLICT',
        { rootFp, legFp }
      );
    }
    fs.unlinkSync(legacyPath);
  } else if (!rootExists && legacyExists) {
    const content = fs.readFileSync(legacyPath, 'utf8');
    const tempRoot = `${rootPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempRoot, content, 'utf8');
    fs.renameSync(tempRoot, rootPath);
    fs.unlinkSync(legacyPath);
  }

  if (!fs.existsSync(rootPath)) {
    throw new ArtifactRegistryError('Cannot reconcile: idea-brief.md does not exist', 'DK_ARTIFACT_MISSING');
  }

  const content = fs.readFileSync(rootPath, 'utf8');
  const fingerprint = computeSha256(content);

  const disc = loadDiscoveryState(rootDir);
  const finalDiscRev = disc.revision;
  const finalDiscFp = disc.fingerprint;

  const resolved = resolveCanonicalIdeaArtifact(rootDir, { verifyFingerprint: false });
  // Monotonic revision increment: reconciliation creates a new artifact revision
  const newRevision = (resolved.registered && resolved.revision) ? resolved.revision + 1 : 1;

  const record = _registerIdeaBriefInternal({
    rootDir,
    canonicalPath: 'idea-brief.md',
    fingerprint,
    revision: newRevision,
    discoveryRevision: finalDiscRev,
    discoveryFingerprint: finalDiscFp,
  });

  return {
    success: true,
    canonicalPath: 'idea-brief.md',
    absolutePath: rootPath,
    fingerprint,
    revision: record.revision,
    discoveryRevision: finalDiscRev,
    discoveryFingerprint: finalDiscFp,
    record,
  };
}

export function migrateLegacyIdeaBrief(rootDir = process.cwd()) {
  return reconcileCanonicalIdeaBrief({ rootDir });
}

