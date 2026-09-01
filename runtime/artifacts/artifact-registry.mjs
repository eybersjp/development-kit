/**
 * Development Kit — Project-Local Authoritative Artifact Registry
 *
 * Manages .development-kit/artifacts.json, canonical artifact path resolution,
 * atomic writing, SHA-256 fingerprinting, and migration/conflict resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
    if (!data.artifacts || typeof data.artifacts !== 'object') {
      return { schemaVersion: ARTIFACT_REGISTRY_SCHEMA_VERSION, artifacts: {} };
    }
    return data;
  } catch (err) {
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

export function resolveCanonicalIdeaArtifact(rootDir = process.cwd()) {
  const registry = loadArtifactRegistry(rootDir);
  const rootPath = path.join(rootDir, 'idea-brief.md');
  const legacyPath = path.join(rootDir, 'docs', 'idea-brief.md');

  const rootExists = fs.existsSync(rootPath) && fs.statSync(rootPath).isFile();
  const legacyExists = fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile();

  if (registry.artifacts.IDEA_BRIEF) {
    const regRel = registry.artifacts.IDEA_BRIEF.canonicalPath;
    const regAbs = path.resolve(rootDir, regRel);
    if (fs.existsSync(regAbs)) {
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
        } else {
          fs.unlinkSync(legacyPath);
        }
      }
      return {
        relativePath: regRel,
        absolutePath: regAbs,
        fingerprint: registry.artifacts.IDEA_BRIEF.fingerprint,
        revision: registry.artifacts.IDEA_BRIEF.revision || 1,
        registered: true,
      };
    }
  }

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
    registerArtifact({
      rootDir,
      key: 'IDEA_BRIEF',
      canonicalPath: 'idea-brief.md',
      artifactType: 'idea-brief',
      lifecycleStage: 'UNDERSTAND',
      fingerprint: rootFp,
      revision: 1,
    });
    return {
      relativePath: 'idea-brief.md',
      absolutePath: rootPath,
      fingerprint: rootFp,
      revision: 1,
      registered: true,
    };
  }

  if (rootExists) {
    const content = fs.readFileSync(rootPath, 'utf8');
    const fp = computeSha256(content);
    registerArtifact({
      rootDir,
      key: 'IDEA_BRIEF',
      canonicalPath: 'idea-brief.md',
      artifactType: 'idea-brief',
      lifecycleStage: 'UNDERSTAND',
      fingerprint: fp,
      revision: 1,
    });
    return {
      relativePath: 'idea-brief.md',
      absolutePath: rootPath,
      fingerprint: fp,
      revision: 1,
      registered: true,
    };
  }

  if (legacyExists) {
    const content = fs.readFileSync(legacyPath, 'utf8');
    const fp = computeSha256(content);
    const tempRoot = `${rootPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempRoot, content, 'utf8');
    fs.renameSync(tempRoot, rootPath);
    fs.unlinkSync(legacyPath);

    registerArtifact({
      rootDir,
      key: 'IDEA_BRIEF',
      canonicalPath: 'idea-brief.md',
      artifactType: 'idea-brief',
      lifecycleStage: 'UNDERSTAND',
      fingerprint: fp,
      revision: 1,
    });
    return {
      relativePath: 'idea-brief.md',
      absolutePath: rootPath,
      fingerprint: fp,
      revision: 1,
      registered: true,
    };
  }

  return {
    relativePath: 'idea-brief.md',
    absolutePath: rootPath,
    fingerprint: null,
    revision: 0,
    registered: false,
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
}) {
  const registry = loadArtifactRegistry(rootDir);
  registry.artifacts[key] = {
    canonicalPath,
    fingerprint,
    artifactType,
    lifecycleStage,
    revision,
    updatedAt: new Date().toISOString(),
  };
  persistArtifactRegistry(registry, rootDir);
  return registry.artifacts[key];
}

export function persistCanonicalIdeaBrief({
  rootDir = process.cwd(),
  content,
}) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new ArtifactRegistryError('Content must be a non-empty string', 'DK_ARTIFACT_INVALID_CONTENT');
  }

  const resolved = resolveCanonicalIdeaArtifact(rootDir);
  const targetAbs = path.resolve(rootDir, 'idea-brief.md');
  const tempPath = `${targetAbs}.tmp.${Date.now()}.${process.pid}`;

  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, targetAbs);

  const fingerprint = computeSha256(content);
  const newRevision = (resolved.registered && resolved.revision) ? resolved.revision + 1 : 1;

  const record = registerArtifact({
    rootDir,
    key: 'IDEA_BRIEF',
    canonicalPath: 'idea-brief.md',
    artifactType: 'idea-brief',
    lifecycleStage: 'UNDERSTAND',
    fingerprint,
    revision: newRevision,
  });

  return {
    success: true,
    canonicalPath: 'idea-brief.md',
    absolutePath: targetAbs,
    fingerprint,
    revision: newRevision,
    record,
  };
}
