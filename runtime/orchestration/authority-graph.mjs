export class AuthorityGraphError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'AuthorityGraphError';
    this.details = details;
  }
}

export const NODE_TYPES = Object.freeze([
  'POD',      // Product Owner Decision
  'REQ',      // Requirement
  'AC',       // Acceptance Criterion
  'ADR',      // Architecture Decision
  'DR',       // Design Rule
  'TASK',     // Task
  'CONTRACT', // Development Contract
  'RESOURCE', // Changed Resource / File
  'CONTROL',  // Security / Verification Control
  'EVIDENCE', // Verification Evidence
  'ACCEPTANCE', // Acceptance Record
]);

export class AuthorityGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, data }
    this.forwardEdges = new Map(); // id -> Set of target ids
    this.reverseEdges = new Map(); // id -> Set of source ids
  }

  addNode(id, type, data = {}) {
    if (typeof id !== 'string' || !id.trim()) throw new AuthorityGraphError('Node ID is required');
    if (!NODE_TYPES.includes(type)) throw new AuthorityGraphError(`Invalid node type: ${type}`);
    const normalizedId = id.trim();
    this.nodes.set(normalizedId, { id: normalizedId, type, data });
    if (!this.forwardEdges.has(normalizedId)) this.forwardEdges.set(normalizedId, new Set());
    if (!this.reverseEdges.has(normalizedId)) this.reverseEdges.set(normalizedId, new Set());
    return this;
  }

  addEdge(sourceId, targetId) {
    const s = sourceId?.trim();
    const t = targetId?.trim();
    if (!this.nodes.has(s)) throw new AuthorityGraphError(`Source node does not exist: ${s}`);
    if (!this.nodes.has(t)) throw new AuthorityGraphError(`Target node does not exist: ${t}`);

    this.forwardEdges.get(s).add(t);
    this.reverseEdges.get(t).add(s);
    return this;
  }

  getDownstream(id) {
    const s = id?.trim();
    return Array.from(this.forwardEdges.get(s) ?? []);
  }

  getUpstream(id) {
    const t = id?.trim();
    return Array.from(this.reverseEdges.get(t) ?? []);
  }

  validateTraceability() {
    const orphans = [];
    const unverifiedRequirements = [];
    const orphanTasks = [];
    const uncoveredCriteria = [];

    for (const [id, node] of this.nodes.entries()) {
      const upstream = this.getUpstream(id);
      const downstream = this.getDownstream(id);

      // Tasks must be authorized by at least one Requirement or Contract
      if (node.type === 'TASK') {
        const hasReqOrContract = upstream.some((u) => {
          const uType = this.nodes.get(u)?.type;
          return uType === 'REQ' || uType === 'POD' || uType === 'CONTRACT';
        });
        if (!hasReqOrContract) {
          orphanTasks.push(id);
        }
      }

      // Requirements must have at least one Acceptance Criterion
      if (node.type === 'REQ') {
        const hasCriteria = downstream.some((d) => this.nodes.get(d)?.type === 'AC');
        if (!hasCriteria) {
          unverifiedRequirements.push(id);
        }
      }

      // Acceptance Criteria must have evidence or controls downstream
      if (node.type === 'AC') {
        const hasEvidence = downstream.some((d) => {
          const dType = this.nodes.get(d)?.type;
          return dType === 'EVIDENCE' || dType === 'CONTROL';
        });
        if (!hasEvidence) {
          uncoveredCriteria.push(id);
        }
      }
    }

    // Disallow superseded POD nodes from participating as active authority
    const supersededNodesInUse = [];
    for (const [id, node] of this.nodes.entries()) {
      if (node.type === 'POD' && node.data?.status === 'SUPERSEDED') {
        const downstream = this.getDownstream(id);
        if (downstream.length > 0) {
          supersededNodesInUse.push(id);
        }
      }
    }

    const complete = orphanTasks.length === 0
      && unverifiedRequirements.length === 0
      && uncoveredCriteria.length === 0
      && supersededNodesInUse.length === 0;

    return {
      complete,
      totalNodes: this.nodes.size,
      orphanTasks,
      unverifiedRequirements,
      uncoveredCriteria,
      supersededNodesInUse,
    };
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.forwardEdges.entries()).flatMap(([src, targets]) =>
        Array.from(targets).map((dst) => ({ source: src, target: dst }))
      ),
    };
  }

  static fromJSON(data) {
    const graph = new AuthorityGraph();
    if (Array.isArray(data?.nodes)) {
      for (const node of data.nodes) {
        graph.addNode(node.id, node.type, node.data);
      }
    }
    if (Array.isArray(data?.edges)) {
      for (const edge of data.edges) {
        graph.addEdge(edge.source, edge.target);
      }
    }
    return graph;
  }
}

export function buildAuthorityGraphFromContract({ contract, verification, rootDir = process.cwd() } = {}) {
  const graph = new AuthorityGraph();
  if (!contract) return graph;

  // Add CONTRACT node
  graph.addNode(contract.contractId, 'CONTRACT', { status: contract.status, scope: contract.scope });

  // Add TASK node
  if (contract.taskId) {
    graph.addNode(contract.taskId, 'TASK', { objective: contract.objective });
    graph.addEdge(contract.contractId, contract.taskId);
  }

  // Add Requirements
  if (Array.isArray(contract.requirements)) {
    for (const req of contract.requirements) {
      const reqId = typeof req === 'string' ? req : req?.id;
      if (reqId) {
        graph.addNode(reqId, 'REQ', typeof req === 'object' ? req : { statement: req });
        graph.addEdge(contract.contractId, reqId);
        if (contract.taskId) graph.addEdge(reqId, contract.taskId);
      }
    }
  }

  // Add Acceptance Criteria
  if (Array.isArray(contract.acceptanceCriteria)) {
    for (const ac of contract.acceptanceCriteria) {
      const acId = typeof ac === 'string' ? ac : ac?.id;
      if (acId) {
        graph.addNode(acId, 'AC', typeof ac === 'object' ? ac : { description: ac });
        if (ac?.requirementId && graph.nodes.has(ac.requirementId)) {
          graph.addEdge(ac.requirementId, acId);
        } else if (contract.requirements && contract.requirements.length > 0) {
          // Link to first requirement if not explicitly keyed
          const firstReqId = typeof contract.requirements[0] === 'string' ? contract.requirements[0] : contract.requirements[0]?.id;
          if (firstReqId && graph.nodes.has(firstReqId)) {
            graph.addEdge(firstReqId, acId);
          }
        }
      }
    }
  }

  // Add Verification Evidence if present
  if (verification && Array.isArray(verification.criteria)) {
    for (const crit of verification.criteria) {
      if (graph.nodes.has(crit.id)) {
        const evidId = `EVID-${crit.id}`;
        graph.addNode(evidId, 'EVIDENCE', { status: crit.status, trustLevel: crit.trustLevel });
        graph.addEdge(crit.id, evidId);
      }
    }
  }

  return graph;
}

