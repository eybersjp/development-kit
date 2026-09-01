const DRIFT_CLASSIFICATIONS = Object.freeze(['EXPECTED', 'AUTHORIZED', 'UNAUTHORIZED', 'REQUIRES_DECISION']);

export class ArchitectureDriftError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchitectureDriftError';
  }
}

function stringSet(value = []) {
  if (!Array.isArray(value)) throw new ArchitectureDriftError('Architecture snapshot fields must be arrays');
  return new Set(value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) throw new ArchitectureDriftError('Architecture snapshot entries must be non-empty strings');
    return item.trim();
  }));
}

function additions(before = [], after = []) {
  const left = stringSet(before);
  return [...stringSet(after)].filter((item) => !left.has(item)).sort();
}

function normalizeAuthorized(value = []) {
  if (!Array.isArray(value)) throw new ArchitectureDriftError('authorizedChanges must be an array');
  return new Set(value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) throw new ArchitectureDriftError('authorized change keys must be strings');
    return item.trim();
  }));
}

function finding(type, value, authorized, expected = false) {
  const key = `${type}:${value}`;
  const classification = expected
    ? 'EXPECTED'
    : authorized.has(key)
      ? 'AUTHORIZED'
      : ['dependency', 'external-service', 'storage', 'auth-pattern', 'migration-strategy'].includes(type)
        ? 'REQUIRES_DECISION'
        : 'UNAUTHORIZED';
  return { key, type, value, classification };
}

export function detectArchitectureDrift({ baseline = {}, current = {}, authorizedChanges = [], expectedChanges = [] } = {}) {
  const authorized = normalizeAuthorized(authorizedChanges);
  const expected = normalizeAuthorized(expectedChanges);
  const fields = [
    ['dependencies', 'dependency'],
    ['externalServices', 'external-service'],
    ['storageTechnologies', 'storage'],
    ['topLevelDirectories', 'top-level-directory'],
    ['apiSurfaces', 'api-surface'],
    ['environmentRequirements', 'environment-requirement'],
    ['migrationStrategies', 'migration-strategy'],
    ['authPatterns', 'auth-pattern'],
  ];

  const findings = [];
  for (const [field, type] of fields) {
    for (const value of additions(baseline[field] ?? [], current[field] ?? [])) {
      const key = `${type}:${value}`;
      findings.push(finding(type, value, authorized, expected.has(key)));
    }
  }

  const blocking = findings.filter((item) => ['UNAUTHORIZED', 'REQUIRES_DECISION'].includes(item.classification));
  return {
    schemaVersion: '1.0.0',
    findings,
    verdict: blocking.length === 0 ? 'PASS' : 'BLOCKED',
    blockingCount: blocking.length,
  };
}

export function validateArchitectureDrift(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new ArchitectureDriftError('Architecture drift report is required');
  if (!Array.isArray(report.findings)) throw new ArchitectureDriftError('Architecture drift findings must be an array');
  for (const item of report.findings) {
    if (!DRIFT_CLASSIFICATIONS.includes(item.classification)) throw new ArchitectureDriftError(`Unsupported drift classification: ${item.classification}`);
  }
  const blocking = report.findings.filter((item) => ['UNAUTHORIZED', 'REQUIRES_DECISION'].includes(item.classification));
  const expectedVerdict = blocking.length === 0 ? 'PASS' : 'BLOCKED';
  if (report.blockingCount !== blocking.length || report.verdict !== expectedVerdict) throw new ArchitectureDriftError('Architecture drift summary is inconsistent');
  return true;
}

export { DRIFT_CLASSIFICATIONS };
