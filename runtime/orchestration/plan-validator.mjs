export class PlanValidationError extends Error {
  constructor(message, report = null) {
    super(message);
    this.name = 'PlanValidationError';
    this.report = report;
  }
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new PlanValidationError(`${label} must be a non-empty string`);
  return value.trim();
}

function stringArray(value = [], label = 'array') {
  if (!Array.isArray(value)) throw new PlanValidationError(`${label} must be an array`);
  return [...new Set(value.map((item) => text(item, `${label} entry`)))];
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new PlanValidationError('tasks must contain at least one task');
  const ids = new Set();
  return tasks.map((task) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw new PlanValidationError('tasks must contain objects');
    const id = text(task.id, 'task.id');
    if (ids.has(id)) throw new PlanValidationError(`Duplicate task id: ${id}`);
    ids.add(id);
    return {
      id,
      dependsOn: stringArray(task.dependsOn ?? [], `${id}.dependsOn`).sort(),
      acceptanceCriteria: stringArray(task.acceptanceCriteria ?? [], `${id}.acceptanceCriteria`).sort(),
      owns: stringArray(task.owns ?? [], `${id}.owns`).sort(),
    };
  });
}

function dependencyEdges(tasks) {
  return tasks.flatMap((task) => task.dependsOn.map((dependency) => `${dependency}->${task.id}`)).sort();
}

function findCycles(tasks) {
  const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  const stack = [];

  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push([...stack.slice(start), id]);
      return;
    }
    if (visited.has(id) || !graph.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const dependency of graph.get(id)) visit(dependency);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of graph.keys()) visit(id);
  return cycles;
}

export function validatePlanModel({
  tasks,
  declaredTaskCount = null,
  declaredDependencyEdges = null,
  requiredResources = [],
  requiredAcceptanceCriteria = [],
} = {}) {
  const normalizedTasks = normalizeTasks(tasks);
  const taskIds = new Set(normalizedTasks.map((task) => task.id));
  const issues = [];

  if (declaredTaskCount !== null) {
    if (!Number.isInteger(declaredTaskCount) || declaredTaskCount < 0) throw new PlanValidationError('declaredTaskCount must be a non-negative integer');
    if (declaredTaskCount !== normalizedTasks.length) {
      issues.push({ code: 'TASK_COUNT_MISMATCH', declared: declaredTaskCount, actual: normalizedTasks.length });
    }
  }

  const missingDependencies = [];
  for (const task of normalizedTasks) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) missingDependencies.push({ taskId: task.id, dependency });
    }
  }
  if (missingDependencies.length) issues.push({ code: 'MISSING_DEPENDENCIES', entries: missingDependencies });

  const cycles = findCycles(normalizedTasks);
  if (cycles.length) issues.push({ code: 'DEPENDENCY_CYCLE', cycles });

  const computedEdges = dependencyEdges(normalizedTasks);
  if (declaredDependencyEdges !== null) {
    const declared = stringArray(declaredDependencyEdges, 'declaredDependencyEdges').sort();
    if (JSON.stringify(declared) !== JSON.stringify(computedEdges)) {
      issues.push({ code: 'DEPENDENCY_DIAGRAM_MISMATCH', declared, computed: computedEdges });
    }
  }

  const ownerMap = new Map();
  for (const task of normalizedTasks) {
    for (const resource of task.owns) {
      if (!ownerMap.has(resource)) ownerMap.set(resource, []);
      ownerMap.get(resource).push(task.id);
    }
  }

  const required = stringArray(requiredResources, 'requiredResources').sort();
  const missingOwners = required.filter((resource) => !ownerMap.has(resource));
  if (missingOwners.length) issues.push({ code: 'MISSING_RESOURCE_OWNER', resources: missingOwners });

  const duplicateOwners = [...ownerMap.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([resource, owners]) => ({ resource, owners: [...owners].sort() }));
  if (duplicateOwners.length) issues.push({ code: 'DUPLICATE_RESOURCE_OWNER', entries: duplicateOwners });

  const criterionOwners = new Map();
  for (const task of normalizedTasks) {
    for (const criterion of task.acceptanceCriteria) {
      if (!criterionOwners.has(criterion)) criterionOwners.set(criterion, []);
      criterionOwners.get(criterion).push(task.id);
    }
  }
  const requiredCriteria = stringArray(requiredAcceptanceCriteria, 'requiredAcceptanceCriteria').sort();
  const uncoveredCriteria = requiredCriteria.filter((criterion) => !criterionOwners.has(criterion));
  if (uncoveredCriteria.length) issues.push({ code: 'ACCEPTANCE_CRITERIA_UNCOVERED', criterionIds: uncoveredCriteria });

  return {
    schemaVersion: '1.0.0',
    valid: issues.length === 0,
    computed: {
      taskCount: normalizedTasks.length,
      dependencyEdges: computedEdges,
      resourceOwners: Object.fromEntries([...ownerMap.entries()].sort(([a], [b]) => a.localeCompare(b))),
      acceptanceCriterionOwners: Object.fromEntries([...criterionOwners.entries()].sort(([a], [b]) => a.localeCompare(b))),
    },
    issues,
  };
}

export function assertPlanValid(input) {
  const report = validatePlanModel(input);
  if (!report.valid) throw new PlanValidationError('PLAN model failed deterministic validation', report);
  return report;
}
