/**
 * Development Kit Next-Step Guidance ? Response Formatter
 *
 * Formats next-step recommendations into canonical user-facing Markdown
 * and provides helper utilities for appending guidance to responses.
 */

import { resolveNextStep } from './resolver.mjs';
import { createDecisionMenu, persistActiveDecisionMenu } from '../orchestration/decision-menu.mjs';

/**
 * Formats a list of recommendations into standard Markdown.
 *
 * @param {Array<{ command: string, description: string, priority: string, reason?: string }>} recommendations
 * @param {object} [options={}]
 * @param {boolean} [options.includeHeader=true] Whether to include the ## Suggested Next Step heading
 * @param {number} [options.headerLevel=2] Markdown header level (default 2)
 * @returns {string} Formatted markdown or empty string if no recommendations
 */
export function formatNextStepGuidance(recommendations = [], options = {}) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return '';
  }

  const includeHeader = options.includeHeader !== false;
  const headerLevel = typeof options.headerLevel === 'number' ? '#'.repeat(options.headerLevel) : '##';
  const isMultiple = recommendations.length > 1;
  const headerTitle = isMultiple ? 'Suggested Next Steps' : 'Suggested Next Step';

  const lines = [];

  if (includeHeader) {
    lines.push(`${headerLevel} ${headerTitle}`);
    lines.push('');
  }

  recommendations.forEach((rec, index) => {
    const itemNum = index + 1;
    const cmd = rec.command.startsWith('/') ? rec.command : `/${rec.command}`;
    const desc = rec.description || 'Proceed to the next lifecycle step.';

    if (isMultiple && index === 0 && !desc.toLowerCase().startsWith('recommended')) {
      lines.push(`${itemNum}. \`${cmd}\``);
      lines.push(`   Recommended. ${desc}`);
    } else {
      lines.push(`${itemNum}. \`${cmd}\``);
      lines.push(`   ${desc}`);
    }

    if (index < recommendations.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Creates and persists a Numbered Next-Step Decision Menu from recommendations.
 */
export function createNextStepDecisionMenu({
  recommendations = [],
  stage = 'UNDERSTAND',
  workflowId = null,
  rootDir = process.cwd(),
} = {}) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return null;
  }

  const options = [];
  recommendations.forEach((rec, idx) => {
    const num = idx + 1;
    const cmd = rec.command.startsWith('/') ? rec.command : `/${rec.command}`;
    options.push({
      number: num,
      label: `Proceed to ${cmd}`,
      description: rec.description || 'Proceed to the next lifecycle step.',
      actionType: 'EXECUTE_COMMAND',
      payload: { command: cmd, reason: rec.reason || null },
      isRecommended: idx === 0,
    });
  });

  // Always append Custom response
  options.push({
    number: options.length + 1,
    label: 'Custom response',
    description: 'Provide an alternative instruction or command.',
    actionType: 'CUSTOM',
    payload: { mode: 'next_step_custom' },
    isCustom: true,
  });

  const menuId = `DEC-NEXTSTEP-${Date.now()}`;
  const menu = createDecisionMenu({
    decisionId: menuId,
    decisionType: 'NEXT_STEP_GUIDANCE',
    title: 'Suggested Next Step',
    prompt: 'Select how you want to proceed with the next lifecycle step:',
    recommendedOption: 1,
    options,
    lifecycleContext: {
      stage,
      workflowId,
    },
  });

  persistActiveDecisionMenu(menu, rootDir);
  return menu;
}

/**
 * Appends next-step guidance to an existing response text if valid recommendations exist.
 *
 * @param {string} content - Existing response content
 * @param {object} context - Next-step context
 * @param {object} [options={}] - Formatting and resolution options
 * @returns {string} Response content with appended guidance, or original content if no guidance
 */
export function appendNextStepGuidance(content = '', context = {}, options = {}) {
  const recommendations = resolveNextStep(context, options);
  if (!recommendations || recommendations.length === 0) {
    return content;
  }

  // Persist decision menu if enabled in options or by default for interactive boundaries
  if (options.persistDecisionMenu !== false) {
    try {
      const rootDir = options.rootDir || process.cwd();
      createNextStepDecisionMenu({
        recommendations,
        stage: context.currentStage || 'UNDERSTAND',
        workflowId: context.workflowId || null,
        rootDir,
      });
    } catch {
      // Gracefully handle persistence failure in read-only / test contexts
    }
  }

  const formatted = formatNextStepGuidance(recommendations, options);
  if (!formatted) {
    return content;
  }

  const trimmed = typeof content === 'string' ? content.trimEnd() : '';
  if (!trimmed) {
    return formatted;
  }

  return `${trimmed}\n\n${formatted}\n`;
}
