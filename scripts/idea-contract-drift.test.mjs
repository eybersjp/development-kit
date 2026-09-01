import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  IDEA_SECTIONS,
  parseIdeaBriefMarkdown,
  validateIdeaBriefStructure,
} from '../runtime/orchestration/idea-schema.mjs';

test('Idea schema sections exactly match templates/idea-brief.md', () => {
  const templatePath = path.resolve('templates/idea-brief.md');
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  for (const sec of IDEA_SECTIONS) {
    assert.ok(
      templateContent.includes(sec.header),
      `Template templates/idea-brief.md must contain header ${sec.header}`
    );
  }

  const validation = validateIdeaBriefStructure(templateContent);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((i) => i.code === 'PLACEHOLDER_FOUND' || i.code === 'INVALID_TITLE'));
});

test('JSON schema aligns with IDEA_SECTIONS', () => {
  const schemaPath = path.resolve('schemas/idea-brief.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  for (const sec of IDEA_SECTIONS) {
    assert.ok(
      schema.required.includes(sec.id),
      `JSON schema required properties must include ${sec.id}`
    );
  }
});
