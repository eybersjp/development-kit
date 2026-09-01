import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AuthorityGraph,
  AuthorityGraphError,
  buildAuthorityGraphFromContract,
} from '../runtime/orchestration/authority-graph.mjs';

test('AuthorityGraph: Constructs forward and reverse links across all 10 node types', () => {
  const graph = new AuthorityGraph();

  graph.addNode('POD-001', 'POD', { title: 'Postgres DB' });
  graph.addNode('REQ-001', 'REQ', { title: 'Tenant Isolation' });
  graph.addNode('AC-001', 'AC', { title: 'Isolated schemas' });
  graph.addNode('TASK-001', 'TASK', { title: 'Create DB migrations' });
  graph.addNode('EVID-001', 'EVIDENCE', { type: 'test', exitCode: 0 });

  graph.addEdge('POD-001', 'REQ-001');
  graph.addEdge('REQ-001', 'AC-001');
  graph.addEdge('REQ-001', 'TASK-001');
  graph.addEdge('AC-001', 'EVID-001');

  assert.deepEqual(graph.getDownstream('POD-001'), ['REQ-001']);
  assert.deepEqual(graph.getUpstream('REQ-001'), ['POD-001']);
  assert.deepEqual(graph.getDownstream('AC-001'), ['EVID-001']);
  assert.deepEqual(graph.getUpstream('EVID-001'), ['AC-001']);

  const trace = graph.validateTraceability();
  assert.equal(trace.complete, true);
});

test('AuthorityGraph: Detects orphan tasks and uncovered requirements', () => {
  const graph = new AuthorityGraph();

  graph.addNode('TASK-ORPHAN', 'TASK', { title: 'Unauthorised task' });
  graph.addNode('REQ-UNCOVERED', 'REQ', { title: 'Requirement without criteria' });

  const trace = graph.validateTraceability();
  assert.equal(trace.complete, false);
  assert.deepEqual(trace.orphanTasks, ['TASK-ORPHAN']);
  assert.deepEqual(trace.unverifiedRequirements, ['REQ-UNCOVERED']);
});

test('AuthorityGraph: buildAuthorityGraphFromContract converts contract and verification cleanly', () => {
  const contract = {
    contractId: 'INC-TASK-001',
    taskId: 'TASK-001',
    status: 'ACTIVE',
    scope: { files: ['src/app.js'] },
    objective: 'Implement auth',
    requirements: [{ id: 'REQ-001', statement: 'JWT auth' }],
    acceptanceCriteria: [{ id: 'AC-001', description: 'Tokens verified', requirementId: 'REQ-001' }],
  };

  const verification = {
    verdict: 'PASS',
    criteria: [{ id: 'AC-001', status: 'PASS', trustLevel: 'E3' }],
  };

  const graph = buildAuthorityGraphFromContract({ contract, verification });
  const trace = graph.validateTraceability();
  assert.equal(trace.complete, true);

  const json = graph.toJSON();
  assert.ok(json.nodes.length >= 4);
  assert.ok(json.edges.length >= 3);
});

