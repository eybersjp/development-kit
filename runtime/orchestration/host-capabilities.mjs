const CAPABILITY_KEYS = Object.freeze([
  'fileRead',
  'fileWrite',
  'shell',
  'git',
  'freshContext',
  'subagents',
  'parallelAgents',
  'browser',
  'visualInspection',
  'externalModelRouting',
]);

const EXECUTION_STRATEGIES = Object.freeze([
  'native-multi-agent',
  'sequential-fresh-context',
  'blocked',
]);

export class HostCapabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HostCapabilityError';
  }
}

export function normalizeHostCapabilities(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HostCapabilityError('Host capabilities must be an object');
  const normalized = { schemaVersion: '1.0.0' };
  for (const key of CAPABILITY_KEYS) {
    const value = input[key] ?? false;
    if (typeof value !== 'boolean') throw new HostCapabilityError(`Host capability ${key} must be boolean`);
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

export function selectExecutionStrategy({ capabilities, contract, requiresVisualEvidence = false } = {}) {
  const normalized = normalizeHostCapabilities(capabilities);
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new HostCapabilityError('Development Contract is required');

  const missing = [];
  if (!normalized.fileRead) missing.push('fileRead');
  if (!normalized.fileWrite) missing.push('fileWrite');
  if (!normalized.freshContext) missing.push('freshContext');
  if (contract.requiredVerification?.includes('tests') && !normalized.shell) missing.push('shell');

  const visualGap = requiresVisualEvidence && !(normalized.browser && normalized.visualInspection);
  if (visualGap) missing.push('browser+visualInspection');

  if (missing.includes('fileRead') || missing.includes('fileWrite') || missing.includes('freshContext')) {
    return {
      strategy: 'blocked',
      capabilities: normalized,
      missingMandatoryCapabilities: missing,
      manualEvidenceRequired: visualGap,
      reason: 'Host cannot provide mandatory independent orchestration capabilities',
    };
  }

  const strategy = normalized.subagents ? 'native-multi-agent' : 'sequential-fresh-context';
  return {
    strategy,
    capabilities: normalized,
    missingMandatoryCapabilities: missing.filter((item) => item !== 'browser+visualInspection'),
    manualEvidenceRequired: visualGap,
    reason: normalized.subagents
      ? 'Host supports isolated sub-agent execution'
      : 'Host will rehydrate sequential fresh contexts inside the current environment',
  };
}

export function assertStrategyUsable(strategyResult) {
  if (!strategyResult || typeof strategyResult !== 'object') throw new HostCapabilityError('Execution strategy result is required');
  if (!EXECUTION_STRATEGIES.includes(strategyResult.strategy)) throw new HostCapabilityError(`Unsupported execution strategy: ${strategyResult.strategy}`);
  if (strategyResult.strategy === 'blocked') throw new HostCapabilityError(strategyResult.reason ?? 'Execution strategy is blocked');
  if (Array.isArray(strategyResult.missingMandatoryCapabilities) && strategyResult.missingMandatoryCapabilities.length > 0) {
    throw new HostCapabilityError(`Missing mandatory host capabilities: ${strategyResult.missingMandatoryCapabilities.join(', ')}`);
  }
  return true;
}

export { CAPABILITY_KEYS, EXECUTION_STRATEGIES };
