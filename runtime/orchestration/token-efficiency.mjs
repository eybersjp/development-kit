const TOKEN_ESTIMATOR = 'chars-div-4-v1';

export const ROLE_TOKEN_BUDGETS = Object.freeze({
  implementation: 16000,
  verification: 18000,
  'technical-review': 12000,
  'design-review': 14000,
  'architecture-review': 14000,
});

export function estimateTextTokens(value = '') {
  return Math.ceil(String(value).length / 4);
}

export function estimateJsonTokens(value) {
  return estimateTextTokens(JSON.stringify(value));
}

function normalizeSelector(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ');
}

function parseLineRange(selector, lineCount) {
  const match = /^L(\d+)\s*-\s*L?(\d+)$/i.exec(String(selector).trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || start > lineCount) return null;
  return { start: start - 1, end: Math.min(end, lineCount) - 1, kind: 'line-range' };
}

function markdownHeadingRange(lines, selector) {
  const wanted = normalizeSelector(selector);
  if (!wanted) return null;

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[index]);
    if (!match) continue;
    const level = match[1].length;
    const heading = normalizeSelector(match[2]);
    if (!(heading === wanted || heading.startsWith(`${wanted} `) || wanted.startsWith(`${heading} `))) continue;

    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{1,6})\s+/.exec(lines[cursor]);
      if (next && next[1].length <= level) {
        end = cursor - 1;
        break;
      }
    }
    return { start: index, end, kind: 'markdown-heading' };
  }
  return null;
}

function markerRange(lines, selector, before = 4, after = 8) {
  const wanted = normalizeSelector(selector);
  if (!wanted) return null;
  const index = lines.findIndex((line) => normalizeSelector(line).includes(wanted));
  if (index === -1) return null;
  return {
    start: Math.max(0, index - before),
    end: Math.min(lines.length - 1, index + after),
    kind: 'marker-window',
  };
}

function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [{ ...sorted[0], selectors: [...(sorted[0].selectors ?? [])] }];
  for (const range of sorted.slice(1)) {
    const current = merged[merged.length - 1];
    if (range.start <= current.end + 1) {
      current.end = Math.max(current.end, range.end);
      current.selectors.push(...(range.selectors ?? []));
    } else {
      merged.push({ ...range, selectors: [...(range.selectors ?? [])] });
    }
  }
  return merged;
}

function renderRanges(lines, ranges) {
  return ranges.map((range) => {
    const label = `[L${range.start + 1}-L${range.end + 1}]`;
    return `${label}\n${lines.slice(range.start, range.end + 1).join('\n')}`;
  }).join('\n\n[… omitted authoritative content …]\n\n');
}

export function materializeScopedContent(content, sections = []) {
  const raw = String(content ?? '');
  const rawTokens = estimateTextTokens(raw);
  const selectors = Array.isArray(sections)
    ? sections.map((section) => String(section).trim()).filter(Boolean)
    : [];

  if (selectors.length === 0) {
    return {
      content: raw,
      deliveryMode: 'full-unscoped',
      resolvedSelectors: [],
      unresolvedSelectors: [],
      warnings: [],
      rawChars: raw.length,
      deliveredChars: raw.length,
      rawTokens,
      deliveredTokens: rawTokens,
    };
  }

  const lines = raw.split(/\r?\n/);
  const resolved = [];
  const unresolved = [];
  const ranges = [];

  for (const selector of selectors) {
    const range = parseLineRange(selector, lines.length)
      ?? markdownHeadingRange(lines, selector)
      ?? markerRange(lines, selector);

    if (!range) {
      unresolved.push(selector);
      continue;
    }
    resolved.push(selector);
    ranges.push({ ...range, selectors: [selector] });
  }

  if (unresolved.length > 0) {
    return {
      content: raw,
      deliveryMode: 'full-fallback',
      resolvedSelectors: resolved,
      unresolvedSelectors: unresolved,
      warnings: [{
        code: 'FULL_FALLBACK_UNRESOLVED_SELECTOR',
        selectors: unresolved,
      }],
      rawChars: raw.length,
      deliveredChars: raw.length,
      rawTokens,
      deliveredTokens: rawTokens,
    };
  }

  const merged = mergeRanges(ranges);
  const delivered = renderRanges(lines, merged);
  return {
    content: delivered,
    deliveryMode: 'scoped',
    resolvedSelectors: resolved,
    unresolvedSelectors: [],
    warnings: [],
    rawChars: raw.length,
    deliveredChars: delivered.length,
    rawTokens,
    deliveredTokens: estimateTextTokens(delivered),
  };
}

export function buildTokenProfile({
  purpose,
  packageValue,
  sources = [],
  roleBudget,
} = {}) {
  const budget = roleBudget ?? ROLE_TOKEN_BUDGETS[purpose] ?? 14000;
  const rawSourceTokens = sources.reduce((sum, source) => sum + Number(source?.delivery?.rawTokens ?? 0), 0);
  const deliveredSourceTokens = sources.reduce((sum, source) => sum + Number(source?.delivery?.deliveredTokens ?? 0), 0);
  const estimatedSourceTokensSaved = Math.max(0, rawSourceTokens - deliveredSourceTokens);
  const sourceSavingsPercent = rawSourceTokens === 0
    ? 0
    : Number(((estimatedSourceTokensSaved / rawSourceTokens) * 100).toFixed(2));
  const estimatedPackageTokens = estimateJsonTokens(packageValue);
  const warnings = sources.flatMap((source) => source?.delivery?.warnings ?? []);
  if (estimatedPackageTokens > budget) {
    warnings.push({
      code: 'CONTEXT_BUDGET_EXCEEDED',
      estimatedPackageTokens,
      roleBudget: budget,
    });
  }

  return {
    estimator: TOKEN_ESTIMATOR,
    roleBudget: budget,
    estimatedPackageTokens,
    rawSourceTokens,
    deliveredSourceTokens,
    estimatedSourceTokensSaved,
    sourceSavingsPercent,
    overBudget: estimatedPackageTokens > budget,
    warnings,
  };
}

export { TOKEN_ESTIMATOR };
