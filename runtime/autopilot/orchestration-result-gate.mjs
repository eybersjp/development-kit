export class AutopilotOrchestrationGateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AutopilotOrchestrationGateError';
  }
}

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new AutopilotOrchestrationGateError(`${label} is required`);
  return value.trim();
}

export function enforceAutopilotOrchestrationGate(state, result) {
  if (!state || !result) throw new AutopilotOrchestrationGateError('Autopilot state and result are required');
  const orchestration = result.orchestration;
  if (orchestration === undefined || orchestration === null) {
    if (state.orchestration?.activeContractId) {
      throw new AutopilotOrchestrationGateError('Contract-aware Autopilot state cannot omit orchestration evidence or downgrade to legacy mode');
    }
    return { legacy: true, enforced: false };
  }
  if (!object(orchestration)) throw new AutopilotOrchestrationGateError('result.orchestration must be an object');

  const activeContractId = requiredString(orchestration.activeContractId, 'orchestration.activeContractId');
  const activeRunId = requiredString(orchestration.activeRunId, 'orchestration.activeRunId');
  const sourceFingerprint = requiredString(orchestration.sourceFingerprint, 'orchestration.sourceFingerprint');
  if (!/^sha256:[a-f0-9]{64}$/.test(sourceFingerprint)) throw new AutopilotOrchestrationGateError('orchestration.sourceFingerprint is invalid');

  if (state.orchestration?.activeContractId && state.orchestration.activeContractId !== activeContractId) {
    throw new AutopilotOrchestrationGateError('Active Development Contract changed without an explicit lifecycle transition');
  }
  if (state.orchestration?.sourceFingerprint && state.orchestration.sourceFingerprint !== sourceFingerprint) {
    throw new AutopilotOrchestrationGateError('Development Contract source fingerprint changed during active orchestration');
  }

  if (result.status === 'completed' && state.currentStage === 'VERIFY' && orchestration.verificationVerdict !== 'PASS') {
    throw new AutopilotOrchestrationGateError('VERIFY stage cannot complete unless independent verification verdict is PASS');
  }
  if (result.status === 'completed' && state.currentStage === 'REVIEW' && orchestration.acceptanceState !== 'ACCEPTED') {
    throw new AutopilotOrchestrationGateError('REVIEW stage cannot complete unless deterministic acceptance state is ACCEPTED');
  }
  if (result.status === 'completed' && state.currentStage === 'COMPLETE' && orchestration.acceptanceState !== 'ACCEPTED') {
    throw new AutopilotOrchestrationGateError('COMPLETE stage cannot complete unless the active increment is accepted');
  }

  state.orchestration = {
    activeContractId,
    activeRunId,
    sourceFingerprint,
    riskLevel: Number.isInteger(orchestration.riskLevel) ? orchestration.riskLevel : state.orchestration?.riskLevel ?? null,
    correctionAttempt: Number.isInteger(orchestration.correctionAttempt) ? orchestration.correctionAttempt : state.orchestration?.correctionAttempt ?? 0,
    verificationVerdict: orchestration.verificationVerdict ?? state.orchestration?.verificationVerdict ?? null,
    acceptanceState: orchestration.acceptanceState ?? state.orchestration?.acceptanceState ?? 'PENDING',
    requiredGates: Array.isArray(orchestration.requiredGates) ? structuredClone(orchestration.requiredGates) : state.orchestration?.requiredGates ?? [],
    completedGates: Array.isArray(orchestration.completedGates) ? structuredClone(orchestration.completedGates) : state.orchestration?.completedGates ?? [],
  };
  return { legacy: false, enforced: true, orchestration: state.orchestration };
}
