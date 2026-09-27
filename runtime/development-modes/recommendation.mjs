/**
 * Read-only, deterministic Development Mode recommendation for project initialization.
 * The recommendation never writes a selection and never changes user choice.
 */
import {
  getDefaultModeConfiguration,
  resolveDevelopmentModeConfiguration,
} from './policy-contract.mjs';

export class DevelopmentModeRecommendationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DevelopmentModeRecommendationError';
    this.code = 'DK_MODE_RECOMMENDATION_INVALID';
  }
}

const ANSWERS = Object.freeze({
  projectType: ['new', 'existing'],
  delivery: ['prototype', 'internal', 'production'],
  requirements: ['unclear', 'evolving', 'clear'],
  documentation: ['lean', 'standard', 'comprehensive'],
  governance: ['lightweight', 'standard', 'strict'],
});

export function recommendDevelopmentMode(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DevelopmentModeRecommendationError('Recommendation answers must be an object');
  }
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(ANSWERS, key) || !ANSWERS[key].includes(value)) {
      throw new DevelopmentModeRecommendationError(`Invalid recommendation answer: ${key}`);
    }
  }
  const answers = {
    projectType: 'new',
    delivery: 'internal',
    requirements: 'evolving',
    documentation: 'standard',
    governance: 'standard',
    ...input,
  };
  let methodology = 'balanced';
  let reason = 'Standard planning and iterative delivery are appropriate for the supplied answers.';
  if (answers.documentation === 'comprehensive') {
    methodology = 'doc-driven';
    reason = 'The requested comprehensive documentation foundation takes priority.';
  } else if (answers.requirements === 'clear' && answers.governance === 'strict') {
    methodology = 'spec-driven';
    reason = 'Clear requirements and strict governance favour approved feature contracts.';
  } else if (answers.delivery === 'prototype' && answers.documentation === 'lean'
    && answers.governance !== 'strict') {
    methodology = 'rapid';
    reason = 'A prototype with lean documentation can use a lighter planning profile.';
  }
  const config = answers.projectType === 'existing'
    ? { ...getDefaultModeConfiguration(), mode: 'maintenance-evolution', baseMethodology: methodology }
    : { ...getDefaultModeConfiguration(), mode: methodology };
  resolveDevelopmentModeConfiguration(config);
  return Object.freeze({
    answers: Object.freeze(answers),
    recommendedConfig: Object.freeze(config),
    reason: answers.projectType === 'existing'
      ? `Existing repository inspection is required. ${reason}`
      : reason,
    advisoryOnly: true,
  });
}
