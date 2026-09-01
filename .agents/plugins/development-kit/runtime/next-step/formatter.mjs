/**
 * Development Kit Next-Step Guidance — Response Formatter
 *
 * Formats next-step recommendations into canonical user-facing Markdown
 * and provides helper utilities for appending guidance to responses.
 */

import { resolveNextStep } from './resolver.mjs';

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
