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
  const duplicateSections = [];
  const unknownSections = [];
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
        if (sections[matched.id] !== undefined) {
          duplicateSections.push({ id: matched.id, header: trimmed });
        }
        currentSection = matched.id;
      } else {
        unknownSections.push({ header: trimmed });
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
    duplicateSections,
    unknownSections,
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
      parsedMustItems: [],
      parsedOpenQuestions: [],
    };
  }

  // Reject duplicate canonical sections
  if (parsed.duplicateSections && parsed.duplicateSections.length > 0) {
    for (const dup of parsed.duplicateSections) {
      issues.push({
        code: 'DUPLICATE_SECTION',
        section: dup.id,
        header: dup.header,
        message: `Duplicate section heading found in Idea Brief: "${dup.header}"`,
      });
    }
  }

  // Reject unknown H2 sections
  if (parsed.unknownSections && parsed.unknownSections.length > 0) {
    for (const unk of parsed.unknownSections) {
      issues.push({
        code: 'UNKNOWN_SECTION',
        header: unk.header,
        message: `Unknown section heading found in Idea Brief: "${unk.header}"`,
      });
    }
  }

  if (!parsed.title || parsed.title === '[Title]' || containsTemplatePlaceholders(parsed.title)) {
    issues.push({
      code: 'INVALID_TITLE',
      section: 'title',
      message: 'Idea Brief title is missing or contains placeholder',
    });
  }

  const parsedMustItems = [];
  const parsedOpenQuestions = [];
  const seenMustIds = new Set();
  const seenQuestionIds = new Set();

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

    // Sections that block approval if blank must have canonical None or actual content
    if (sec.blocksApprovalIfEmpty && sec.allowEmptyInDraft && content !== undefined) {
      if (!content.trim()) {
        issues.push({
          code: 'EMPTY_SECTION_BLOCKS_APPROVAL',
          section: sec.id,
          header: sec.header,
          message: `Section ${sec.title} cannot be completely blank. Use "- None" if no entries apply.`,
        });
      }
    }

    if (!sec.allowEmptyInDraft && (!content.trim() || isCanonicalNone(content))) {
      issues.push({
        code: 'EMPTY_SECTION',
        section: sec.id,
        header: sec.header,
        message: `Section ${sec.title} cannot be empty in draft`,
      });
    }

    // Canonical item grammar validation for Requirements (Must)
    if (sec.id === 'requirementsMust') {
      const rawLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (rawLines.length === 0 || isCanonicalNone(content)) {
        issues.push({
          code: 'CANONICAL_GRAMMAR_ERROR',
          section: sec.id,
          header: sec.header,
          message: 'Requirements (Must) cannot be empty or None',
        });
      } else {
        for (const line of rawLines) {
          // Reject numbered lists, plain paragraphs, or non-bullet lines
          if (!line.startsWith('- ') && !line.startsWith('* ')) {
            issues.push({
              code: 'CANONICAL_GRAMMAR_ERROR',
              section: sec.id,
              header: sec.header,
              message: `Must requirement item must start with bullet "- ": "${line}"`,
            });
            continue;
          }
          const bulletBody = line.replace(/^[-*]\s*/, '').trim();
          if (isCanonicalNone(bulletBody)) {
            issues.push({
              code: 'CANONICAL_GRAMMAR_ERROR',
              section: sec.id,
              header: sec.header,
              message: 'Requirements (Must) cannot contain None',
            });
            continue;
          }
          const match = bulletBody.match(/^\[(IDEA-REQ-\d+)\]\s+(.+)$/i);
          if (!match) {
            issues.push({
              code: 'CANONICAL_GRAMMAR_ERROR',
              section: sec.id,
              header: sec.header,
              message: `Must requirement line must strictly match "- [IDEA-REQ-xxx] <statement>": "${line}"`,
            });
            continue;
          }
          const reqId = match[1].toUpperCase();
          const statement = match[2].trim();
          // Check for multiple candidate tags on same line
          if (/\[IDEA-REQ-\d+\]/gi.test(statement)) {
            issues.push({
              code: 'MULTIPLE_REQUIREMENT_REFERENCES',
              section: sec.id,
              header: sec.header,
              message: `Must requirement line contains multiple candidate IDs: "${line}"`,
            });
            continue;
          }
          // Case-insensitive duplicate reference check
          if (seenMustIds.has(reqId)) {
            issues.push({
              code: 'DUPLICATE_REQUIREMENT_REFERENCE',
              id: reqId,
              section: sec.id,
              header: sec.header,
              message: `Duplicate requirement reference: ${reqId}`,
            });
            continue;
          }
          seenMustIds.add(reqId);
          parsedMustItems.push({ id: reqId, statement, rawLine: line });
        }
      }
    }

    // Canonical item grammar validation for Open Questions
    if (sec.id === 'openQuestions') {
      const rawLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (rawLines.length > 0 && !isCanonicalNone(content)) {
        let hasNone = false;
        let hasReal = false;
        for (const line of rawLines) {
          if (!line.startsWith('- ') && !line.startsWith('* ')) {
            issues.push({
              code: 'CANONICAL_GRAMMAR_ERROR',
              section: sec.id,
              header: sec.header,
              message: `Open question item must start with bullet "- ": "${line}"`,
            });
            continue;
          }
          const bulletBody = line.replace(/^[-*]\s*/, '').trim();
          if (isCanonicalNone(bulletBody)) {
            hasNone = true;
            continue;
          }
          hasReal = true;
          const match = bulletBody.match(/^\[(IDEA-Q-\d+)\]\s+(.+)$/i);
          if (!match) {
            issues.push({
              code: 'CANONICAL_GRAMMAR_ERROR',
              section: sec.id,
              header: sec.header,
              message: `Open question line must strictly match "- [IDEA-Q-xxx] <question>" or "- None": "${line}"`,
            });
            continue;
          }
          const qId = match[1].toUpperCase();
          const questionText = match[2].trim();
          if (/\[IDEA-Q-\d+\]/gi.test(questionText)) {
            issues.push({
              code: 'MULTIPLE_QUESTION_REFERENCES',
              section: sec.id,
              header: sec.header,
              message: `Open question line contains multiple question IDs: "${line}"`,
            });
            continue;
          }
          // Case-insensitive duplicate question reference check
          if (seenQuestionIds.has(qId)) {
            issues.push({
              code: 'DUPLICATE_QUESTION_REFERENCE',
              id: qId,
              section: sec.id,
              header: sec.header,
              message: `Duplicate question reference: ${qId}`,
            });
            continue;
          }
          seenQuestionIds.add(qId);
          parsedOpenQuestions.push({ id: qId, question: questionText, rawLine: line });
        }
        if (hasNone && hasReal) {
          issues.push({
            code: 'CANONICAL_GRAMMAR_ERROR',
            section: sec.id,
            header: sec.header,
            message: 'Open Questions cannot mix "- None" with active question items',
          });
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    sections: parsed.sections,
    title: parsed.title,
    parsedMustItems,
    parsedOpenQuestions,
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

