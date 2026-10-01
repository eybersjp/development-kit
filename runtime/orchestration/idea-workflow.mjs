/**
 * DKF IDEA Authority — deterministic, persisted, one-interaction-at-a-time workflow.
 *
 * Every user-facing interaction is persisted before presentation and backed by the
 * existing Numbered Decision Interface. Consumption requires the exact interaction
 * fingerprint and explicit Product Owner authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  createDecisionMenu,
  computeDecisionMenuFingerprint,
  loadActiveDecisionMenu,
  persistActiveDecisionMenu,
  resolveDecisionInput,
} from './decision-menu.mjs';
import {
  loadDiscoveryState,
  resolveRequirementCandidate,
  classifyRequirementScope,
  resolveOpenQuestion,
  evaluateDiscoveryReadiness,
} from './idea-discovery.mjs';
import {
  loadIdeaDesignState,
  setIdeaDesignApplicability,
  setIdeaDesignDisposition,
} from './idea-design.mjs';
import {
  inspectIdeaBrief,
  approveCurrentIdeaBrief,
} from './idea-artifact.mjs';
import {
  appendIdeaConsumption,
  findConsumedInteraction,
} from './idea-consumptions.mjs';

export const IDEA_WORKFLOW_SCHEMA_VERSION = '1.0.0';
export const IDEA_WORKFLOW_PHASES = Object.freeze([
  'INITIAL_DISCOVERY',
  'REQUIREMENTS_INTERVIEW',
  'REQUIREMENT_CONFIRMATION',
  'DESIGN_APPLICABILITY',
  'DESIGN_SYSTEM_SETUP',
  'SCOPE_CONFIRMATION',
  'BRIEF_DRAFT',
  'BRIEF_APPROVAL',
  'COMPLETE',
]);

export class IdeaWorkflowError extends Error {
  constructor(message, code = 'DK_IDEA_WORKFLOW_ERROR', details = null) {
    super(message);
    this.name = 'IdeaWorkflowError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code = 'DK_IDEA_WORKFLOW_INVALID', details = null) {
  throw new IdeaWorkflowError(message, code, details);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function sha(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

export function getIdeaWorkflowPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
}

export function computeIdeaSourceFingerprint(rootDir = process.cwd()) {
  const discovery = loadDiscoveryState(rootDir);
  const design = loadIdeaDesignState(rootDir);
  return sha({
    discoveryRevision: discovery.revision,
    discoveryFingerprint: discovery.fingerprint,
    designRevision: design.revision,
    designFingerprint: design.fingerprint,
  });
}

export function computeIdeaInteractionFingerprint(interaction) {
  if (!interaction || typeof interaction !== 'object') return null;
  return sha({
    type: interaction.type,
    id: interaction.id,
    prompt: interaction.prompt,
    options: interaction.options,
    metadata: interaction.metadata ?? null,
    sourceFingerprint: interaction.sourceFingerprint,
    decisionMenuFingerprint: interaction.decisionMenuFingerprint,
  });
}

function emptyWorkflow(rootDir) {
  const discovery = loadDiscoveryState(rootDir);
  const design = loadIdeaDesignState(rootDir);
  return {
    schemaVersion: IDEA_WORKFLOW_SCHEMA_VERSION,
    workflowRevision: 0,
    currentPhase: 'INITIAL_DISCOVERY',
    status: 'ACTION_REQUIRED',
    pendingInteraction: null,
    discoveryRevision: discovery.revision,
    discoveryFingerprint: discovery.fingerprint,
    designRevision: design.revision,
    designFingerprint: design.fingerprint,
    lastArtifactRevision: null,
    customInstruction: null,
    updatedAt: null,
  };
}

export function validateIdeaWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) fail('IDEA workflow must be an object', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (workflow.schemaVersion !== IDEA_WORKFLOW_SCHEMA_VERSION) fail('Unsupported IDEA workflow schemaVersion', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (!Number.isSafeInteger(workflow.workflowRevision) || workflow.workflowRevision < 0) fail('Invalid IDEA workflow revision', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (!IDEA_WORKFLOW_PHASES.includes(workflow.currentPhase)) fail('Invalid IDEA workflow phase', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (!['ACTION_REQUIRED', 'PENDING', 'CUSTOM_INPUT_REVIEW', 'COMPLETE'].includes(workflow.status)) fail('Invalid IDEA workflow status', 'DK_IDEA_WORKFLOW_CORRUPT');
  for (const field of ['discoveryFingerprint', 'designFingerprint']) {
    if (!/^sha256:[a-f0-9]{64}$/.test(workflow[field] || '')) fail(`Invalid ${field}`, 'DK_IDEA_WORKFLOW_CORRUPT');
  }
  if (!Number.isSafeInteger(workflow.discoveryRevision) || workflow.discoveryRevision < 0) fail('Invalid discovery revision in workflow', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (!Number.isSafeInteger(workflow.designRevision) || workflow.designRevision < 0) fail('Invalid design revision in workflow', 'DK_IDEA_WORKFLOW_CORRUPT');
  if (workflow.pendingInteraction !== null) {
    const pi = workflow.pendingInteraction;
    if (!pi || typeof pi !== 'object' || typeof pi.type !== 'string' || typeof pi.id !== 'string') fail('Invalid pending IDEA interaction', 'DK_IDEA_WORKFLOW_CORRUPT');
    if (!Array.isArray(pi.options) || pi.options.length < 2) fail('Pending IDEA interaction needs numbered options', 'DK_IDEA_WORKFLOW_CORRUPT');
    if (!/^sha256:[a-f0-9]{64}$/.test(pi.sourceFingerprint || '')) fail('Pending interaction source fingerprint is invalid', 'DK_IDEA_WORKFLOW_CORRUPT');
    if (!/^sha256:[a-f0-9]{64}$/.test(pi.decisionMenuFingerprint || '')) fail('Pending interaction menu fingerprint is invalid', 'DK_IDEA_WORKFLOW_CORRUPT');
    if (pi.fingerprint !== computeIdeaInteractionFingerprint(pi)) fail('Pending interaction fingerprint mismatch', 'DK_INTERACTION_FINGERPRINT_MISMATCH');
  }
  return true;
}

export function loadIdeaWorkflow(rootDir = process.cwd()) {
  const filePath = getIdeaWorkflowPath(rootDir);
  if (!fs.existsSync(filePath)) return emptyWorkflow(rootDir);
  try {
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateIdeaWorkflow(workflow);
    return workflow;
  } catch (error) {
    if (error instanceof IdeaWorkflowError) throw error;
    fail(`Unable to load IDEA workflow: ${error.message}`, 'DK_IDEA_WORKFLOW_CORRUPT');
  }
}

function persistWorkflow(rootDir, previous, patch) {
  const discovery = loadDiscoveryState(rootDir);
  const design = loadIdeaDesignState(rootDir);
  const next = {
    ...previous,
    ...patch,
    schemaVersion: IDEA_WORKFLOW_SCHEMA_VERSION,
    workflowRevision: previous.workflowRevision + 1,
    discoveryRevision: discovery.revision,
    discoveryFingerprint: discovery.fingerprint,
    designRevision: design.revision,
    designFingerprint: design.fingerprint,
    updatedAt: new Date().toISOString(),
  };
  validateIdeaWorkflow(next);
  atomicWrite(getIdeaWorkflowPath(rootDir), next);
  return next;
}

function menuOptions(options) {
  return options.map((option, index) => ({
    number: index + 1,
    label: option.label,
    description: option.description ?? null,
    actionType: option.actionType,
    payload: option.payload ?? {},
    isCustom: option.actionType === 'CUSTOM',
  }));
}

function persistInteraction(rootDir, workflow, {
  phase,
  type,
  id,
  prompt,
  options,
  metadata = null,
  recommendedOption = 1,
} = {}) {
  if (workflow.pendingInteraction) return workflow;
  const sourceFingerprint = computeIdeaSourceFingerprint(rootDir);
  const decisionId = `DEC-IDEA-${type.replace(/[^A-Za-z0-9]+/g, '-')}-${String(workflow.workflowRevision + 1).padStart(4, '0')}`;
  const menu = createDecisionMenu({
    decisionId,
    decisionType: `IDEA_${type}`,
    title: prompt,
    prompt,
    recommendedOption,
    options: menuOptions(options),
    lifecycleContext: { stage: 'UNDERSTAND', phase },
    sourceFingerprint,
  });
  persistActiveDecisionMenu(menu, rootDir);
  const interaction = {
    type,
    id,
    prompt,
    options: options.map((option, index) => ({
      number: index + 1,
      label: option.label,
      actionType: option.actionType,
    })),
    metadata,
    sourceFingerprint,
    decisionId,
    decisionMenuFingerprint: computeDecisionMenuFingerprint(menu),
    fingerprint: null,
    persistedAt: new Date().toISOString(),
  };
  interaction.fingerprint = computeIdeaInteractionFingerprint(interaction);
  return persistWorkflow(rootDir, workflow, {
    currentPhase: phase,
    status: 'PENDING',
    pendingInteraction: interaction,
    customInstruction: null,
  });
}

function ensurePendingFresh(rootDir, workflow) {
  if (!workflow.pendingInteraction) return;
  const currentSource = computeIdeaSourceFingerprint(rootDir);
  if (workflow.pendingInteraction.sourceFingerprint !== currentSource) {
    fail(
      'Persisted IDEA interaction is stale because discovery/design authority changed before consumption',
      'DK_INTERACTION_SOURCE_STALE',
      { expected: workflow.pendingInteraction.sourceFingerprint, actual: currentSource },
    );
  }
  const menu = loadActiveDecisionMenu(rootDir);
  if (!menu || menu.decisionId !== workflow.pendingInteraction.decisionId) {
    fail('Persisted IDEA interaction has no matching active numbered decision menu', 'DK_INTERACTION_MENU_MISSING');
  }
  if (computeDecisionMenuFingerprint(menu) !== workflow.pendingInteraction.decisionMenuFingerprint) {
    fail('Persisted IDEA interaction menu changed after presentation', 'DK_INTERACTION_FINGERPRINT_MISMATCH');
  }
}

export function ensurePendingIdeaInteraction(rootDir = process.cwd()) {
  let workflow = loadIdeaWorkflow(rootDir);
  if (workflow.pendingInteraction) {
    ensurePendingFresh(rootDir, workflow);
    return workflow;
  }
  if (workflow.status === 'CUSTOM_INPUT_REVIEW') return workflow;

  const discovery = loadDiscoveryState(rootDir);
  const design = loadIdeaDesignState(rootDir);
  const artifact = inspectIdeaBrief(rootDir);

  if (discovery.requirements.length === 0 && discovery.openQuestions.length === 0) {
    if (workflow.currentPhase !== 'INITIAL_DISCOVERY' || workflow.status !== 'ACTION_REQUIRED') {
      workflow = persistWorkflow(rootDir, workflow, { currentPhase: 'INITIAL_DISCOVERY', status: 'ACTION_REQUIRED' });
    }
    return { ...workflow, nextAction: 'RECORD_DISCOVERY_CANDIDATES_OR_QUESTIONS' };
  }

  const unresolvedQuestion = discovery.openQuestions.find((question) => question.resolution === 'UNRESOLVED');
  if (unresolvedQuestion) {
    const options = unresolvedQuestion.options.map((label) => ({
      label,
      actionType: 'ANSWER_QUESTION',
      payload: { answer: label },
    }));
    options.push({ label: 'Custom answer', actionType: 'CUSTOM', payload: {} });
    return persistInteraction(rootDir, workflow, {
      phase: 'REQUIREMENTS_INTERVIEW',
      type: 'DISCOVERY_QUESTION',
      id: unresolvedQuestion.id,
      prompt: unresolvedQuestion.question,
      options,
      metadata: { questionId: unresolvedQuestion.id },
    });
  }

  const unresolvedRequirement = discovery.requirements.find((req) => req.resolutionState === 'UNRESOLVED');
  if (unresolvedRequirement) {
    const primaryAction = ['USER_STATED', 'USER_CONFIRMED'].includes(unresolvedRequirement.origin) ? 'CONFIRM_REQUIREMENT' : 'ADOPT_REQUIREMENT';
    const primaryLabel = primaryAction === 'CONFIRM_REQUIREMENT' ? 'Confirm this exact requirement' : 'Adopt this proposal as an approved requirement';
    return persistInteraction(rootDir, workflow, {
      phase: 'REQUIREMENT_CONFIRMATION',
      type: 'REQUIREMENT_CONFIRMATION',
      id: unresolvedRequirement.id,
      prompt: `How should ${unresolvedRequirement.id} be treated? “${unresolvedRequirement.statement}”`,
      options: [
        { label: primaryLabel, actionType: primaryAction, payload: { requirementId: unresolvedRequirement.id } },
        { label: 'Defer this requirement', actionType: 'DEFER_REQUIREMENT', payload: { requirementId: unresolvedRequirement.id } },
        { label: 'Reject this requirement', actionType: 'REJECT_REQUIREMENT', payload: { requirementId: unresolvedRequirement.id } },
        { label: 'Custom response', actionType: 'CUSTOM', payload: { requirementId: unresolvedRequirement.id } },
      ],
      metadata: { requirementId: unresolvedRequirement.id, origin: unresolvedRequirement.origin },
    });
  }

  if (design.applicable === null) {
    return persistInteraction(rootDir, workflow, {
      phase: 'DESIGN_APPLICABILITY',
      type: 'DESIGN_APPLICABILITY',
      id: 'IDEA-DESIGN-APPLICABILITY',
      prompt: 'Does this project include a visual user interface that requires Design Authority?',
      options: [
        { label: 'Yes — visual UI (web, mobile, or desktop)', actionType: 'DESIGN_APPLICABLE', payload: { applicable: true } },
        { label: 'No — non-visual/backend/CLI/library only', actionType: 'DESIGN_NOT_APPLICABLE', payload: { applicable: false } },
        { label: 'Custom response', actionType: 'CUSTOM', payload: {} },
      ],
    });
  }

  if (design.applicable === true && design.disposition === null) {
    return persistInteraction(rootDir, workflow, {
      phase: 'DESIGN_SYSTEM_SETUP',
      type: 'DESIGN_SYSTEM_SETUP',
      id: 'IDEA-DESIGN-SETUP',
      prompt: 'Which Design Authority setup should this project use?',
      options: [
        { label: 'Attach design references', actionType: 'DESIGN_DISPOSITION', payload: { disposition: 'ATTACH_REFERENCES' } },
        { label: 'Use an existing design.md', actionType: 'DESIGN_DISPOSITION', payload: { disposition: 'USE_EXISTING_DESIGN_MD' } },
        { label: 'Derive the design system from an existing application', actionType: 'DESIGN_DISPOSITION', payload: { disposition: 'DERIVE_EXISTING_APPLICATION' } },
        { label: 'Create a new design direction without references', actionType: 'DESIGN_DISPOSITION', payload: { disposition: 'CREATE_NEW_DIRECTION' } },
        { label: 'Defer for now — blocks first frontend implementation', actionType: 'DESIGN_DISPOSITION', payload: { disposition: 'DEFERRED' } },
        { label: 'Custom response', actionType: 'CUSTOM', payload: {} },
      ],
    });
  }

  const unclassified = discovery.requirements.find((req) =>
    ['CONFIRMED', 'ADOPTED'].includes(req.resolutionState) && req.scopeDisposition === 'UNCLASSIFIED'
  );
  if (unclassified) {
    return persistInteraction(rootDir, workflow, {
      phase: 'SCOPE_CONFIRMATION',
      type: 'SCOPE_CONFIRMATION',
      id: unclassified.id,
      prompt: `What approved scope should ${unclassified.id} have? “${unclassified.statement}”`,
      options: [
        { label: 'Must Have', actionType: 'CLASSIFY_SCOPE', payload: { requirementId: unclassified.id, disposition: 'MUST' } },
        { label: 'Should Have', actionType: 'CLASSIFY_SCOPE', payload: { requirementId: unclassified.id, disposition: 'SHOULD' } },
        { label: 'Future / explicitly deferred', actionType: 'CLASSIFY_SCOPE', payload: { requirementId: unclassified.id, disposition: 'FUTURE' } },
        { label: 'Explicitly excluded', actionType: 'CLASSIFY_SCOPE', payload: { requirementId: unclassified.id, disposition: 'EXCLUDED' } },
        { label: 'Custom response', actionType: 'CUSTOM', payload: { requirementId: unclassified.id } },
      ],
    });
  }

  const readiness = evaluateDiscoveryReadiness(rootDir);
  if (!readiness.ready) fail('Discovery cannot progress', 'DK_IDEA_DISCOVERY_NOT_READY', readiness.blockers);

  if (!artifact.current || artifact.status === 'TAMPERED' || artifact.status === 'ABSENT' || artifact.status === 'MISSING') {
    workflow = persistWorkflow(rootDir, workflow, {
      currentPhase: 'BRIEF_DRAFT',
      status: 'ACTION_REQUIRED',
      pendingInteraction: null,
      lastArtifactRevision: artifact.record?.revision ?? null,
    });
    return { ...workflow, nextAction: 'PERSIST_CANONICAL_IDEA_BRIEF', artifact };
  }

  if (artifact.approvalStatus === 'CURRENT') {
    workflow = persistWorkflow(rootDir, workflow, {
      currentPhase: 'COMPLETE',
      status: 'COMPLETE',
      pendingInteraction: null,
      lastArtifactRevision: artifact.record?.revision ?? null,
    });
    return workflow;
  }

  return persistInteraction(rootDir, workflow, {
    phase: 'BRIEF_APPROVAL',
    type: 'BRIEF_APPROVAL',
    id: 'IDEA-BRIEF-APPROVAL',
    prompt: `Approve current Idea Brief revision ${artifact.record.revision} bound to discovery revision ${artifact.record.discoveryRevision}?`,
    options: [
      { label: 'Approve the current Idea Brief', actionType: 'APPROVE_BRIEF', payload: {} },
      { label: 'Return to draft for changes', actionType: 'REVISE_BRIEF', payload: {} },
      { label: 'Custom response', actionType: 'CUSTOM', payload: {} },
    ],
    metadata: {
      artifactRevision: artifact.record.revision,
      artifactFingerprint: artifact.record.artifactFingerprint,
      sourceFingerprint: artifact.record.sourceFingerprint,
    },
  });
}

function decisionIdsFromResult(result) {
  const ids = [];
  if (result?.resolutionDecisionId) ids.push(result.resolutionDecisionId);
  if (result?.scopeDecisionId) ids.push(result.scopeDecisionId);
  if (result?.decisionId) ids.push(result.decisionId);
  if (result?.applicabilityDecisionId) ids.push(result.applicabilityDecisionId);
  if (result?.dispositionDecisionId) ids.push(result.dispositionDecisionId);
  return [...new Set(ids.filter(Boolean))];
}

export function consumePendingIdeaInteraction(rootDir = process.cwd(), {
  selectedNumber,
  authority,
  expectedInteractionFingerprint,
  customText = null,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const workflow = loadIdeaWorkflow(rootDir);
  if (!workflow.pendingInteraction || workflow.status !== 'PENDING') fail('No pending IDEA interaction exists', 'DK_IDEA_NO_PENDING_INTERACTION');
  ensurePendingFresh(rootDir, workflow);
  if (expectedInteractionFingerprint !== workflow.pendingInteraction.fingerprint) {
    fail('Expected interaction fingerprint does not match the exact persisted interaction', 'DK_INTERACTION_FINGERPRINT_MISMATCH', {
      expected: workflow.pendingInteraction.fingerprint,
      provided: expectedInteractionFingerprint ?? null,
    });
  }

  const pre = loadDiscoveryState(rootDir);
  if (findConsumedInteraction(rootDir, {
    interactionFingerprint: workflow.pendingInteraction.fingerprint,
    workflowRevisionBefore: workflow.workflowRevision,
    preDiscoveryRevision: pre.revision,
    preDiscoveryFingerprint: pre.fingerprint,
  })) {
    fail('The exact IDEA interaction has already been consumed', 'DK_INTERACTION_ALREADY_CONSUMED');
  }

  const activeMenu = loadActiveDecisionMenu(rootDir);
  const selectedOption = activeMenu?.options?.find((option) => option.number === Number(selectedNumber));
  if (selectedOption?.actionType === 'CUSTOM' && (typeof customText !== 'string' || !customText.trim())) {
    fail('Custom response selection requires customText', 'DK_IDEA_CUSTOM_TEXT_REQUIRED');
  }

  const resolution = resolveDecisionInput({
    input: selectedNumber,
    activeMenu,
    rootDir,
    expectedStage: 'UNDERSTAND',
    currentFingerprint: workflow.pendingInteraction.sourceFingerprint,
    authority: 'Product Owner',
  });
  if (!resolution.success) fail(resolution.message, `DK_DECISION_${resolution.reason}`);
  const actionType = resolution.actionType;
  const payload = resolution.payload ?? {};

  if (actionType === 'CUSTOM') {
    appendIdeaConsumption(rootDir, {
      interactionType: workflow.pendingInteraction.type,
      interactionId: workflow.pendingInteraction.id,
      interactionFingerprint: workflow.pendingInteraction.fingerprint,
      workflowRevisionBefore: workflow.workflowRevision,
      preDiscoveryRevision: pre.revision,
      preDiscoveryFingerprint: pre.fingerprint,
      postDiscoveryRevision: pre.revision,
      postDiscoveryFingerprint: pre.fingerprint,
      authority: 'PRODUCT_OWNER',
      action: 'CUSTOM',
    });
    return persistWorkflow(rootDir, workflow, {
      status: 'CUSTOM_INPUT_REVIEW',
      pendingInteraction: null,
      customInstruction: customText.trim(),
    });
  }

  let result = null;
  let artifactApprovalId = null;
  switch (actionType) {
    case 'ANSWER_QUESTION':
      result = resolveOpenQuestion(rootDir, {
        id: workflow.pendingInteraction.id,
        resolution: 'ANSWERED',
        answer: payload.answer,
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'CONFIRM_REQUIREMENT':
      result = resolveRequirementCandidate(rootDir, {
        id: payload.requirementId,
        action: 'CONFIRM',
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'ADOPT_REQUIREMENT':
      result = resolveRequirementCandidate(rootDir, {
        id: payload.requirementId,
        action: 'ADOPT',
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'DEFER_REQUIREMENT':
      result = resolveRequirementCandidate(rootDir, {
        id: payload.requirementId,
        action: 'DEFER',
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'REJECT_REQUIREMENT':
      result = resolveRequirementCandidate(rootDir, {
        id: payload.requirementId,
        action: 'REJECT',
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'DESIGN_APPLICABLE':
      result = setIdeaDesignApplicability(rootDir, { applicable: true, authority: 'PRODUCT_OWNER' });
      break;
    case 'DESIGN_NOT_APPLICABLE':
      result = setIdeaDesignApplicability(rootDir, { applicable: false, authority: 'PRODUCT_OWNER' });
      break;
    case 'DESIGN_DISPOSITION':
      result = setIdeaDesignDisposition(rootDir, { disposition: payload.disposition, authority: 'PRODUCT_OWNER' });
      break;
    case 'CLASSIFY_SCOPE':
      result = classifyRequirementScope(rootDir, {
        id: payload.requirementId,
        disposition: payload.disposition,
        authority: 'PRODUCT_OWNER',
      });
      break;
    case 'APPROVE_BRIEF':
      result = approveCurrentIdeaBrief(rootDir, { authority: 'PRODUCT_OWNER' });
      artifactApprovalId = result.id;
      break;
    case 'REVISE_BRIEF': {
      const post = loadDiscoveryState(rootDir);
      appendIdeaConsumption(rootDir, {
        interactionType: workflow.pendingInteraction.type,
        interactionId: workflow.pendingInteraction.id,
        interactionFingerprint: workflow.pendingInteraction.fingerprint,
        workflowRevisionBefore: workflow.workflowRevision,
        preDiscoveryRevision: pre.revision,
        preDiscoveryFingerprint: pre.fingerprint,
        postDiscoveryRevision: post.revision,
        postDiscoveryFingerprint: post.fingerprint,
        authority: 'PRODUCT_OWNER',
        action: actionType,
      });
      return persistWorkflow(rootDir, workflow, {
        currentPhase: 'BRIEF_DRAFT',
        status: 'ACTION_REQUIRED',
        pendingInteraction: null,
        customInstruction: 'Product Owner requested Idea Brief revision.',
      });
    }
    default:
      fail(`Unsupported IDEA decision action: ${actionType}`, 'DK_IDEA_UNSUPPORTED_ACTION');
  }

  const post = loadDiscoveryState(rootDir);
  appendIdeaConsumption(rootDir, {
    interactionType: workflow.pendingInteraction.type,
    interactionId: workflow.pendingInteraction.id,
    interactionFingerprint: workflow.pendingInteraction.fingerprint,
    workflowRevisionBefore: workflow.workflowRevision,
    preDiscoveryRevision: pre.revision,
    preDiscoveryFingerprint: pre.fingerprint,
    postDiscoveryRevision: post.revision,
    postDiscoveryFingerprint: post.fingerprint,
    authority: 'PRODUCT_OWNER',
    action: actionType,
    resultingDecisionIds: decisionIdsFromResult(result),
    artifactApprovalId,
  });

  const cleared = persistWorkflow(rootDir, workflow, {
    status: 'ACTION_REQUIRED',
    pendingInteraction: null,
    customInstruction: null,
  });
  return ensurePendingIdeaInteraction(rootDir, cleared);
}

export function completeIdeaCustomInstruction(rootDir = process.cwd(), {
  authority,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const workflow = loadIdeaWorkflow(rootDir);
  if (workflow.status !== 'CUSTOM_INPUT_REVIEW' || !workflow.customInstruction) {
    fail('No custom IDEA instruction is awaiting review', 'DK_IDEA_NO_CUSTOM_REVIEW');
  }
  const cleared = persistWorkflow(rootDir, workflow, {
    status: 'ACTION_REQUIRED',
    customInstruction: null,
    pendingInteraction: null,
  });
  return ensurePendingIdeaInteraction(rootDir, cleared);
}

export function refreshStaleIdeaInteraction(rootDir = process.cwd(), {
  authority,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const workflow = loadIdeaWorkflow(rootDir);
  if (!workflow.pendingInteraction) return ensurePendingIdeaInteraction(rootDir);
  const current = computeIdeaSourceFingerprint(rootDir);
  if (current === workflow.pendingInteraction.sourceFingerprint) return workflow;
  const cleared = persistWorkflow(rootDir, workflow, {
    status: 'ACTION_REQUIRED',
    pendingInteraction: null,
    customInstruction: null,
  });
  return ensurePendingIdeaInteraction(rootDir, cleared);
}
