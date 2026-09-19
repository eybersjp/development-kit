import fs from 'node:fs';
import path from 'node:path';

export function getPreviewStatePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'runtime', 'ui-preview.json');
}

export function getPreviewLogDir(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'runtime', 'ui-preview');
}

export function readPreviewState(rootDir = process.cwd()) {
  const statePath = getPreviewStatePath(rootDir);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writePreviewState(state, rootDir = process.cwd()) {
  const statePath = getPreviewStatePath(rootDir);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${statePath}.tmp-${process.pid}-${Date.now()}`;
  const next = { ...state, updatedAt: new Date().toISOString() };
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, statePath);
  return next;
}

export function clearPreviewState(rootDir = process.cwd()) {
  const statePath = getPreviewStatePath(rootDir);
  try { fs.rmSync(statePath, { force: true }); } catch {}
}
