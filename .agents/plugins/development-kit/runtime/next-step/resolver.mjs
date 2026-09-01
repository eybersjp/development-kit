/**
 * Development Kit Next-Step Guidance — Central Resolver
 *
 * Centralized, context-aware engine that determines valid next `/dk-*` commands
 * based on lifecycle stage, command results, test/verification status, safety gates,
 * computed IDEA state, and explicit human approvals.
 */

import { CANONICAL_LIFECYCLE_STAGES, normalizeContext, RECOMMENDATION_PRIORITIES } from './types.mjs';
import { defaultCommandRegistry, CommandRegistry } from './command-registry.mjs';
import { computeIdeaStageState } from '../orchestration/idea-state.mjs';

export const COMMAND_TO_STAGE_MAP = Object.freeze({
  '/dk-idea': 'UNDERSTAND',
  '/dk-spec': 'DEFINE',
  '/dk-design': 'DESIGN',
  '/dk-tasks': 'PLAN',
  '/dk-build': 'IMPLEMENT',
  '/dk-build-auto': 'IMPLEMENT',
  '/dk-test': 'VERIFY',
  '/dk-review': 'REVIEW',
  '/dk-simplify': 'SIMPLIFY',
  '/dk-ship': 'COMPLETE',
  '/dk-debug': 'RECOVERY',
  '/dk-status': 'INFORMATIONAL',
  '/dk-research': 'RESEARCH',
  '/dk-autopilot': 'LIFECYCLE_WIDE'
});

export class NextStepResolver {
  constructor(options = {}) {
    this.registry = options.registry || defaultCommandRegistry;
    this.maxRecommendations = typeof options.maxRecommendations === 'number' ? options.maxRecommendations : 3;
  }

  resolve(rawContext = {}, options = {}) {
    const ctx = normalizeContext(rawContext);
    const maxRecs = typeof options.maxRecommendations === 'number'
      ? options.maxRecommendations
      : this.maxRecommendations;

    if (ctx.isWorkflowComplete) {
      return [];
    }

    if (ctx.isAutomated && !ctx.isPaused) {
      return [];
    }

    if (ctx.completedCommand) {
      const normalizedCmd = ctx.completedCommand.startsWith('/dk-')
        ? ctx.completedCommand
        : (ctx.completedCommand.startsWith('/') ? ctx.completedCommand : `/dk-${ctx.completedCommand}`);
      if (!this.registry.has(normalizedCmd)) {
        return [{
          command: '/dk-status',
          description: `Inspect workflow state and active tasks after unknown command (${ctx.completedCommand}).`,
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Unknown command cannot determine forward lifecycle progression.'
        }];
      }
    }

    const recommendations = [];
    const stage = this._determineEffectiveStage(ctx);

    if (ctx.isPaused) {
      recommendations.push({
        command: '/dk-status',
        description: 'Inspect paused workflow state, active action leases, and pending gates.',
        priority: RECOMMENDATION_PRIORITIES.PRIMARY,
        reason: 'Workflow execution is currently paused.'
      });
      return this._filterAndFormatRecommendations(recommendations, ctx, maxRecs);
    }

    // Nuanced Blocker Handling
    if (ctx.blockers.length > 0) {
      const isRuntimeBlocker = ctx.blockerType === 'RUNTIME_FRAMEWORK';
      const isProductBlocker = ctx.blockerType === 'PRODUCT_DISCOVERY' || (!isRuntimeBlocker && (ctx.completedCommand === '/dk-idea' || stage === 'UNDERSTAND'));
      if (!isRuntimeBlocker && isProductBlocker) {
        recommendations.push({
          command: '/dk-idea',
          description: `Resolve active product/discovery blocker(s): ${ctx.blockers.join(', ')}.`,
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Product discovery blockers require user clarification.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect active blockers, pending gates, and current lifecycle state.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Review overall workflow state.'
        });
      } else {
        recommendations.push({
          command: '/dk-debug',
          description: `Investigate and resolve active blocker(s): ${ctx.blockers.join(', ')}.`,
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Active blockers halt standard lifecycle progression.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect active blockers, pending gates, and current lifecycle state.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Review overall workflow state.'
        });
      }
      return this._filterAndFormatRecommendations(recommendations, ctx, maxRecs);
    }

    const hasFailures = !ctx.success ||
      ctx.verificationStatus === 'failed' ||
      ctx.testsStatus === 'failed' ||
      ctx.reviewStatus === 'failed' ||
      ctx.postSimplificationVerificationStatus === 'failed' ||
      ctx.repositoryStatus === 'failed';

    if (hasFailures) {
      this._resolveFailureRecommendations(ctx, stage, recommendations);
      return this._filterAndFormatRecommendations(recommendations, ctx, maxRecs);
    }

    this._resolveSuccessRecommendations(ctx, stage, recommendations);
    return this._filterAndFormatRecommendations(recommendations, ctx, maxRecs);
  }

  _determineEffectiveStage(ctx) {
    if (ctx.lifecycleStage && CANONICAL_LIFECYCLE_STAGES.includes(ctx.lifecycleStage)) {
      return ctx.lifecycleStage;
    }

    if (ctx.completedCommand) {
      const normalizedCmd = ctx.completedCommand.startsWith('/dk-')
        ? ctx.completedCommand
        : (ctx.completedCommand.startsWith('/') ? ctx.completedCommand : `/dk-${ctx.completedCommand}`);
      if (COMMAND_TO_STAGE_MAP[normalizedCmd]) {
        return COMMAND_TO_STAGE_MAP[normalizedCmd];
      }
    }

    return 'UNDERSTAND';
  }

  _resolveFailureRecommendations(ctx, stage, recommendations) {
    const cmd = ctx.completedCommand
      ? (ctx.completedCommand.startsWith('/dk-') ? ctx.completedCommand : (ctx.completedCommand.startsWith('/') ? ctx.completedCommand : `/dk-${ctx.completedCommand}`))
      : null;

    if (cmd === '/dk-review' || ctx.reviewStatus === 'failed') {
      recommendations.push({
        command: '/dk-build',
        description: 'Address code quality, specification compliance, security, or design review findings.',
        priority: RECOMMENDATION_PRIORITIES.PRIMARY,
        reason: 'Review gate identified unresolved issues requiring implementation fixes.'
      });
      recommendations.push({
        command: '/dk-review',
        description: 'Re-run the review cycle once review findings are corrected.',
        priority: RECOMMENDATION_PRIORITIES.SECONDARY,
        reason: 'Re-review diff.'
      });
      return;
    }

    if (cmd === '/dk-simplify' || ctx.postSimplificationVerificationStatus === 'failed') {
      recommendations.push({
        command: '/dk-test',
        description: 'Run the verification suite to identify regressions introduced during simplification.',
        priority: RECOMMENDATION_PRIORITIES.PRIMARY,
        reason: 'Simplification introduced test failures or regressions.'
      });
      recommendations.push({
        command: '/dk-debug',
        description: 'Investigate and resolve simplification regressions using root-cause debugging.',
        priority: RECOMMENDATION_PRIORITIES.SECONDARY,
        reason: 'Debug simplification issue.'
      });
      return;
    }

    if (cmd === '/dk-ship' || stage === 'COMPLETE') {
      recommendations.push({
        command: '/dk-debug',
        description: 'Investigate and resolve release readiness or pre-shipping verification failures.',
        priority: RECOMMENDATION_PRIORITIES.PRIMARY,
        reason: 'Pre-ship checks or completion gates failed.'
      });
      recommendations.push({
        command: '/dk-status',
        description: 'Inspect which completion gates or release checks failed.',
        priority: RECOMMENDATION_PRIORITIES.SECONDARY,
        reason: 'Check gate details.'
      });
      return;
    }

    if (cmd === '/dk-build-auto') {
      recommendations.push({
        command: '/dk-debug',
        description: 'Investigate task implementation failure encountered during automated execution.',
        priority: RECOMMENDATION_PRIORITIES.PRIMARY,
        reason: 'Batch automated execution paused on failure.'
      });
      recommendations.push({
        command: '/dk-status',
        description: 'Inspect active task plan, completed tasks, and failed task output.',
        priority: RECOMMENDATION_PRIORITIES.SECONDARY,
        reason: 'Check batch status.'
      });
      return;
    }

    recommendations.push({
      command: '/dk-debug',
      description: 'Investigate and resolve test or verification failures using systematic root-cause debugging.',
      priority: RECOMMENDATION_PRIORITIES.PRIMARY,
      reason: 'Verification or operation reported failures.'
    });
    recommendations.push({
      command: '/dk-status',
      description: 'Inspect current workflow state and diagnostic details.',
      priority: RECOMMENDATION_PRIORITIES.SECONDARY,
      reason: 'Check status.'
    });
  }

  _resolveSuccessRecommendations(ctx, stage, recommendations) {
    const cmd = ctx.completedCommand
      ? (ctx.completedCommand.startsWith('/dk-') ? ctx.completedCommand : (ctx.completedCommand.startsWith('/') ? ctx.completedCommand : `/dk-${ctx.completedCommand}`))
      : null;

    switch (cmd) {
      case '/dk-autopilot':
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect current workflow progress across lifecycle stages.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Autopilot state inspection.'
        });
        break;

      case '/dk-idea':
        this._resolveIdeaStageRecommendations(ctx, recommendations);
        break;

      case '/dk-research':
        recommendations.push({
          command: '/dk-spec',
          description: 'Incorporate external research findings into the specification artifacts.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'External research completed; proceed to specification.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Review current workflow state and gathered research evidence.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Check status.'
        });
        break;

      case '/dk-spec':
        recommendations.push({
          command: '/dk-design',
          description: 'Produce technical and visual design including architecture, data models, and API contracts.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Specification approved; proceed to technical design.'
        });
        break;

      case '/dk-design':
        recommendations.push({
          command: '/dk-tasks',
          description: 'Break approved architecture into small, verifiable tasks with dependency ordering.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Technical design complete; decompose into implementation tasks.'
        });
        break;

      case '/dk-tasks':
        recommendations.push({
          command: '/dk-build',
          description: 'Implement the first task through every verification gate using a fresh sub-agent.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Task plan approved; begin implementation loop.'
        });
        recommendations.push({
          command: '/dk-build-auto',
          description: 'Process the entire approved task plan automatically, pausing on failures or gates.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Batch automated execution option.'
        });
        break;

      case '/dk-build':
        if (ctx.remainingTasks && ctx.remainingTasks > 0 && ctx.verificationStatus === 'passed') {
          recommendations.push({
            command: '/dk-build',
            description: `Implement the next uncompleted task (${ctx.remainingTasks} task${ctx.remainingTasks > 1 ? 's' : ''} remaining).`,
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Task completed successfully; more tasks remain in plan.'
          });
        } else {
          recommendations.push({
            command: '/dk-test',
            description: 'Verify the completed implementation, tests, documentation, and repository state before progressing.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Implementation finished; run verification gate.'
          });
        }
        break;

      case '/dk-build-auto':
        recommendations.push({
          command: '/dk-test',
          description: 'Verify the entire plan implementation across unit, integration, and runtime test suites.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Batch automated implementation completed; run full verification gate.'
        });
        break;

      case '/dk-test':
        recommendations.push({
          command: '/dk-review',
          description: 'Run the full review cycle: specification compliance, code quality, security, and accessibility.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Verification passed; proceed to two-stage review.'
        });
        break;

      case '/dk-review':
        recommendations.push({
          command: '/dk-simplify',
          description: 'Apply the Ponytail simplicity ladder to remove unnecessary code, abstractions, and dependencies.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Review approved; apply simplicity ladder.'
        });
        break;

      case '/dk-simplify':
        recommendations.push({
          command: '/dk-test',
          description: 'Re-run the verification suite to confirm no regressions were introduced during simplification.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Simplification complete; verify clean test run before shipping.'
        });
        break;

      case '/dk-debug':
        if (ctx.previousCommand && ctx.previousCommand !== '/dk-debug') {
          const prevNorm = ctx.previousCommand.startsWith('/dk-') ? ctx.previousCommand : `/dk-${ctx.previousCommand}`;
          recommendations.push({
            command: prevNorm,
            description: `Re-run ${prevNorm} now that the root-cause fix has been applied.`,
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Re-run command after debugging fix.'
          });
        } else {
          recommendations.push({
            command: '/dk-test',
            description: 'Run the test suite to verify that the debugging fix successfully resolved the issue.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Debug fix applied; re-verify.'
          });
        }
        break;

      case '/dk-ship':
        if (!ctx.isWorkflowComplete) {
          recommendations.push({
            command: '/dk-status',
            description: 'Inspect remaining release gates and completion checklist.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Shipping state inspection.'
          });
        }
        break;

      case '/dk-status':
        this._resolveStageBasedRecommendations(ctx, stage, recommendations);
        break;

      default:
        this._resolveStageBasedRecommendations(ctx, stage, recommendations);
        break;
    }
  }

  _resolveIdeaStageRecommendations(ctx, recommendations) {
    let ideaState;
    try {
      ideaState = computeIdeaStageState(ctx.rootDir);
    } catch (_) {
      ideaState = { state: 'DISCOVERY_IN_PROGRESS' };
    }

    switch (ideaState.state) {
      case 'APPROVED':
        recommendations.push({
          command: '/dk-spec',
          description: 'Create the minimum required specification artifacts for the approved concept.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Idea discovery completed and approved by Product Owner.'
        });
        break;

      case 'READY_FOR_APPROVAL':
        recommendations.push({
          command: '/dk-idea',
          description: 'Obtain explicit Product Owner approval for the completed Idea Brief.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Idea Brief is ready for final Product Owner approval.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect discovery state and requirement provenance.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Review readiness details.'
        });
        break;

      case 'DRAFT_READY':
        recommendations.push({
          command: '/dk-idea',
          description: 'Resolve unconfirmed AI proposals or open questions in discovery.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Draft brief complete; discovery questions require user confirmation.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect discovery status and unconfirmed candidate items.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Review draft issues.'
        });
        break;

      case 'BLOCKED':
        recommendations.push({
          command: ideaState.blockerType === 'RUNTIME_FRAMEWORK' ? '/dk-debug' : '/dk-idea',
          description: `Resolve blocking condition: ${(ideaState.issues || []).map(i => i.message).join(', ')}.`,
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'IDEA stage is blocked.'
        });
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect blocker details.',
          priority: RECOMMENDATION_PRIORITIES.SECONDARY,
          reason: 'Check status.'
        });
        break;

      case 'NOT_STARTED':
      case 'DISCOVERY_IN_PROGRESS':
      default:
        recommendations.push({
          command: '/dk-idea',
          description: 'Continue requirements interview and complete discovery.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Idea discovery is in progress.'
        });
        break;
    }
  }

  _resolveStageBasedRecommendations(ctx, stage, recommendations) {
    switch (stage) {
      case 'UNDERSTAND':
        this._resolveIdeaStageRecommendations(ctx, recommendations);
        break;
      case 'DEFINE':
        recommendations.push({
          command: '/dk-design',
          description: 'Produce technical and visual design based on the specification.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Technical design.'
        });
        break;
      case 'DESIGN':
        recommendations.push({
          command: '/dk-tasks',
          description: 'Break approved architecture into verifiable tasks.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Task decomposition.'
        });
        break;
      case 'PLAN':
        recommendations.push({
          command: '/dk-build',
          description: 'Begin implementation of planned tasks.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Start build.'
        });
        break;
      case 'IMPLEMENT':
        recommendations.push({
          command: '/dk-test',
          description: 'Run verification on implemented changes.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Run tests.'
        });
        break;
      case 'VERIFY':
        recommendations.push({
          command: '/dk-review',
          description: 'Perform code quality and specification compliance review.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Review cycle.'
        });
        break;
      case 'REVIEW':
        recommendations.push({
          command: '/dk-simplify',
          description: 'Apply the Ponytail simplicity ladder to eliminate unnecessary code.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Simplify code.'
        });
        break;
      case 'SIMPLIFY':
        recommendations.push({
          command: '/dk-test',
          description: 'Re-run tests after simplification.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'Regression verification.'
        });
        break;
      case 'COMPLETE':
        if (this._isShipEligible(ctx)) {
          recommendations.push({
            command: '/dk-ship',
            description: 'Perform final release readiness verification, diff inspection, and release preparation.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'All gates passed and explicit human approval granted.'
          });
        } else {
          recommendations.push({
            command: '/dk-review',
            description: 'Review pending approval gates and confirm verification evidence before shipping.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Consequential action /dk-ship requires explicit approval and verified test results.'
          });
          recommendations.push({
            command: '/dk-status',
            description: 'Inspect approval status and active gate checklist.',
            priority: RECOMMENDATION_PRIORITIES.SECONDARY,
            reason: 'Check gate checklist.'
          });
        }
        break;
      default:
        recommendations.push({
          command: '/dk-status',
          description: 'Inspect current workflow state and active tasks.',
          priority: RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: 'State inspection.'
        });
        break;
    }
  }

  _isShipEligible(ctx) {
    return (
      ctx.success === true &&
      ctx.approvalStatus === 'approved' &&
      ctx.verificationStatus === 'passed' &&
      ctx.testsStatus === 'passed' &&
      ctx.reviewStatus === 'passed' &&
      ctx.postSimplificationVerificationStatus === 'passed' &&
      Array.isArray(ctx.blockers) && ctx.blockers.length === 0 &&
      Array.isArray(ctx.outstandingApprovals) && ctx.outstandingApprovals.length === 0 &&
      !ctx.isAutomated
    );
  }

  _filterAndFormatRecommendations(rawRecs, ctx, maxRecs) {
    const validRecs = [];
    const seenCommands = new Set();

    for (const item of rawRecs) {
      if (!item || !item.command) continue;

      const normalizedCmd = item.command.startsWith('/dk-')
        ? item.command
        : (item.command.startsWith('/') ? item.command : `/dk-${item.command}`);

      if (!this.registry.has(normalizedCmd)) {
        continue;
      }

      if (normalizedCmd === '/dk-ship' && !this._isShipEligible(ctx)) {
        if (!seenCommands.has('/dk-review')) {
          seenCommands.add('/dk-review');
          validRecs.push({
            command: '/dk-review',
            description: 'Review pending approval gates and confirm verification evidence before shipping.',
            priority: RECOMMENDATION_PRIORITIES.PRIMARY,
            reason: 'Consequential action /dk-ship requires explicit approval and verified test results.'
          });
        }
        continue;
      }

      if (!seenCommands.has(normalizedCmd)) {
        seenCommands.add(normalizedCmd);
        validRecs.push({
          command: normalizedCmd,
          description: item.description,
          priority: item.priority || RECOMMENDATION_PRIORITIES.PRIMARY,
          reason: item.reason
        });
      }

      if (validRecs.length >= maxRecs) {
        break;
      }
    }

    return validRecs.map((rec, index) => ({
      ...rec,
      priority: index === 0 ? RECOMMENDATION_PRIORITIES.PRIMARY : RECOMMENDATION_PRIORITIES.SECONDARY
    }));
  }
}

export function resolveNextStep(context, options) {
  const resolver = new NextStepResolver(options);
  return resolver.resolve(context, options);
}
