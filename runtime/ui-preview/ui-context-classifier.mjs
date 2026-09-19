const UI_SIGNALS = Object.freeze([
  ['design-system', /\bdesign\s+system\b|\bdesign\.md\b/i],
  ['frontend', /\bfront[- ]?end\b|\bfrontend\b/i],
  ['ui', /\bui\b|\buser\s+interface\b/i],
  ['ux', /\bux\b|\buser\s+experience\b/i],
  ['page-screen', /\bpage(?:s)?\b|\bscreen(?:s)?\b/i],
  ['component', /\bcomponent(?:s)?\b/i],
  ['layout', /\blayout(?:s)?\b/i],
  ['navigation', /\bnavigation\b|\bnavbar\b|\bsidebar\b/i],
  ['form-dialog', /\bform(?:s)?\b|\bdialog(?:s)?\b|\bmodal(?:s)?\b/i],
  ['dashboard-table-card', /\bdashboard(?:s)?\b|\btable(?:s)?\b|\bcard(?:s)?\b/i],
  ['styling', /\bcss\b|\btailwind\b|\btypography\b|\bspacing\b|\bcolour\b|\bcolor\b/i],
  ['responsive', /\bresponsive\b|\bmobile\b|\btablet\b|\bdesktop\b/i],
  ['visual', /\bvisual\b|\bappearance\b|\btheme\b/i],
  ['interaction-state', /\bhover\b|\bfocus\b|\bactive\s+state\b|\binteraction\b|\banimation\b/i],
]);

export function normalizeContext(input) {
  if (Array.isArray(input)) return input.filter(Boolean).join(' ');
  if (input == null) return '';
  if (typeof input === 'object') return JSON.stringify(input);
  return String(input);
}

export function classifyUiContext(input) {
  const context = normalizeContext(input).trim();
  const signals = context
    ? UI_SIGNALS.filter(([, pattern]) => pattern.test(context)).map(([name]) => name)
    : [];
  const affectsUi = signals.length > 0;
  return { affectsUi, previewRequired: affectsUi, signals };
}

export { UI_SIGNALS };
