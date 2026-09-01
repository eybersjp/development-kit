import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  IDEA_SECTIONS,
  parseIdeaBriefMarkdown,
  validateIdeaBriefStructure,
  generateIdeaBriefJsonSchema,
} from '../runtime/orchestration/idea-schema.mjs';

test('Idea schema sections exactly match templates/idea-brief.md in order and count', () => {
  const templatePath = path.resolve('templates/idea-brief.md');
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  // Exact 10 canonical sections
  assert.equal(IDEA_SECTIONS.length, 10, 'Must define exactly 10 canonical sections');

  const headersInTemplate = templateContent.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.trim());
  assert.equal(headersInTemplate.length, 10, 'Template must contain exactly 10 section headers');

  for (let i = 0; i < IDEA_SECTIONS.length; i++) {
    assert.equal(
      headersInTemplate[i],
      IDEA_SECTIONS[i].header,
      `Section ${i + 1} header in template must match ${IDEA_SECTIONS[i].header}`
    );
  }

  const validation = validateIdeaBriefStructure(templateContent);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((i) => i.code === 'PLACEHOLDER_FOUND' || i.code === 'INVALID_TITLE'));
});

test('JSON schema is strictly equal to single-source generated schema', () => {
  const schemaPath = path.resolve('schemas/idea-brief.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const generated = generateIdeaBriefJsonSchema();

  assert.deepEqual(
    schema,
    generated,
    'Committed schemas/idea-brief.schema.json must strictly match single-source generateIdeaBriefJsonSchema()'
  );
});
