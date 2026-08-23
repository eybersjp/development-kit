import fs from 'node:fs';

import { createDevelopmentContract } from './development-contract.mjs';

export class ContractPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractPolicyError';
  }
}

function designGoverned(task) {
  return Boolean(task?.touchesUi)
    || (Array.isArray(task?.designConstraints) && task.designConstraints.length > 0);
}

export function bindAuthoritativeSources({ rootDir = process.cwd(), task, authoritativeSources = [] } = {}) {
  if (!Array.isArray(authoritativeSources) || authoritativeSources.length === 0) {
    throw new ContractPolicyError('authoritativeSources must contain at least one source');
  }
  const sources = structuredClone(authoritativeSources);
  if (!designGoverned(task)) return sources;

  const hasDesign = sources.some((source) => source?.kind === 'design-authority' || /(^|[\\/])design\.md$/i.test(source?.path ?? ''));
  if (hasDesign) return sources;
  if (!fs.existsSync(`${rootDir}/design.md`) || !fs.statSync(`${rootDir}/design.md`).isFile()) {
    throw new ContractPolicyError('UI/design-governed task requires authoritative design.md before contract creation');
  }
  sources.push({
    path: 'design.md',
    kind: 'design-authority',
    authority: 'required',
    sections: [],
  });
  return sources;
}

export function createPolicyBoundDevelopmentContract(options = {}) {
  const authoritativeSources = bindAuthoritativeSources(options);
  return createDevelopmentContract({ ...options, authoritativeSources });
}
