/**
 * Development Kit — Authoritative IDEA Artifact Schema & Contract
 *
 * Single machine-readable source of truth for IDEA Brief artifacts.
 * Defines section structure, parsing, placeholder detection, and structural validity.
 */

export const IDEA_SCHEMA_VERSION = '1.0.0';

export class IdeaValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'IdeaValidationError';
    this.issues = issues;
  }
}

/**
 * Authoritative Section Definitions matching templates/idea-brief.md
 */
export const IDEA_SECTIONS = Object.freeze([
  {
    id: 'problem',
    title: 'Problem',
    header: '## Problem',
    requiredInDraft: true,
    allowEmptyInDraft: false,
    allowCanonicalNone: false,
    blocksApprovalIfEmpty: true,
  },
  {
    id: 'intendedUsers',
    title: 'Intended Users',
    header: '## Intended Users',
    requiredInDraft: true,
    allowEmptyInDraft: false,
    allowCanonicalNone: false,
    blocksApprovalIfEmpty: true,
  },
  {
    id: 'successCriteria',
    title: 'Success Criteria',
    header: '## Success Criteria',
    requiredInDraft: true,
    allowEmptyInDraft: false,
    allowCanonicalNone: false,
    blocksApprovalIfEmpty: true,
  },
  {
    id: 'requirementsMust',
    title: 'Requirements (Must)',
    header: '## Requirements (Must)',
    requiredInDraft: true,
    allowEmptyInDraft: false,
    allowCanonicalNone: false,
    blocksApprovalIfEmpty: true,
  },
  {
    id: 'preferencesShould',
    title: 'Preferences (Should)',
    header: '## Preferences (Should)',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: false,
  },
  {
    id: 'assumptions',
    title: 'Assumptions',
    header: '## Assumptions',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: false,
  },
  {
    id: 'constraints',
    title: 'Constraints',
    header: '## Constraints',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: false,
  },
  {
    id: 'risks',
    title: 'Risks',
    header: '## Risks',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: false,
  },
  {
    id: 'openQuestions',
    title: 'Open Questions',
    header: '## Open Questions',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: true,
  },
  {
    id: 'futureIdeas',
    title: 'Future Ideas (Explicitly Deferred)',
    header: '## Future Ideas (Explicitly Deferred)',
    requiredInDraft: true,
    allowEmptyInDraft: true,
    allowCanonicalNone: true,
    blocksApprovalIfEmpty: false,
  },
]);

export const FORBIDDEN_PLACEHOLDER_PATTERNS = [
  /\[Title\]/i,
  /\[Requirement\s*\d*\]/i,
  /\[Preference\s*\d*\]/i,
  /\[Assumption\s*\d*\]/i,
  /\[Constraint\s*\d*:[^\]]*\]/i,
  /\[Risk\s*\d*:[^\]]*\]/i,
  /\[Question\s*\d*\]/i,
  /\[Future\s*idea\s*\d*\]/i,
  /\[What problem are we solving\?[^\]]*\]/i,
  /\[Who will use this\?[^\]]*\]/i,
  /\[How will we know this idea is successfully implemented\?\]/i,
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bLorem\s+ipsum\b/i,
];

export function isCanonicalNone(text) {
  if (!text) return true;
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed === 'none' ||
    trimmed === 'none.' ||
    trimmed === '- none' ||
    trimmed === '- none.' ||
    trimmed === '* none' ||
    trimmed === '* none.' ||
    trimmed === 'n/a' ||
    trimmed === '- n/a'
  );
}

export function containsTemplatePlaceholders(text) {
  if (!text) return false;
  for (const pattern of FORBIDDEN_PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

export function parseIdeaBriefMarkdown(markdownText) {
  if (typeof markdownText !== 'string' || !markdownText.trim()) {
    throw new IdeaValidationError('Idea Brief markdown content is empty or not a string', [
      { code: 'EMPTY_CONTENT', message: 'Content is empty' },
    ]);
  }

  const lines = markdownText.split('\n');
  const sections = {};
  let currentSection = null;
  let currentLines = [];
  let title = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# Idea Brief:')) {
      title = trimmed.replace('# Idea Brief:', '').trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = currentLines.join('\n').trim();
        currentLines = [];
      }
      const matched = IDEA_SECTIONS.find((s) => s.header === trimmed);
      if (matched) {
        currentSection = matched.id;
      } else {
        currentSection = trimmed.replace('## ', '').trim();
      }
      continue;
    }

    if (currentSection) {
      currentLines.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentLines.join('\n').trim();
  }

  return {
    title,
    sections,
  };
}

export function validateIdeaBriefStructure(markdownText) {
  const issues = [];
  let parsed;

  try {
    parsed = parseIdeaBriefMarkdown(markdownText);
  } catch (err) {
    return {
      valid: false,
      issues: err.issues || [{ code: 'PARSE_FAILED', message: err.message }],
      sections: {},
      title: null,
    };
  }

  if (!parsed.title || parsed.title === '[Title]' || containsTemplatePlaceholders(parsed.title)) {
    issues.push({
      code: 'INVALID_TITLE',
      section: 'title',
      message: 'Idea Brief title is missing or contains placeholder',
    });
  }

  for (const sec of IDEA_SECTIONS) {
    const content = parsed.sections[sec.id];
    if (content === undefined) {
      issues.push({
        code: 'MISSING_SECTION',
        section: sec.id,
        header: sec.header,
        message: `Missing required section: ${sec.title}`,
      });
      continue;
    }

    if (containsTemplatePlaceholders(content)) {
      issues.push({
        code: 'PLACEHOLDER_FOUND',
        section: sec.id,
        header: sec.header,
        message: `Section ${sec.title} contains unfinished template placeholders`,
      });
    }

    if (!sec.allowEmptyInDraft && (!content.trim() || isCanonicalNone(content))) {
      issues.push({
        code: 'EMPTY_SECTION',
        section: sec.id,
        header: sec.header,
        message: `Section ${sec.title} cannot be empty in draft`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    sections: parsed.sections,
    title: parsed.title,
  };
}

export function generateIdeaBriefJsonSchema() {
  const properties = {
    title: { type: 'string' }
  };
  const required = ['title'];

  for (const sec of IDEA_SECTIONS) {
    properties[sec.id] = { type: 'string' };
    required.push(sec.id);
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://development-kit.dev/schemas/idea-brief.schema.json',
    title: 'Development Kit Idea Brief Artifact Schema',
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  };
}

