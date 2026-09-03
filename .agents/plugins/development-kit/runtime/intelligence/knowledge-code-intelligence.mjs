/**
 * Development Kit Intelligence — Knowledge & Code Intelligence Contracts
 *
 * Implements native provider contracts and repository baseline implementations for:
 * 1. DK Knowledge (list, query, read markdown/docs)
 * 2. DK Code Intelligence (files, symbols, search, impact)
 */

import fs from 'node:fs';
import path from 'node:path';
import { DKProvider } from './memory-provider-contract.mjs';

/**
 * Native Repository Knowledge Provider
 */
export class NativeKnowledgeProvider extends DKProvider {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || process.cwd();
    this.providerId = 'native-knowledge';
    this.displayName = 'DK Native Knowledge';
    this.version = '0.7.0';
  }

  async detect() {
    return { providerId: this.providerId, installed: true, available: true, dataLocation: 'local' };
  }

  async health() {
    return { status: 'healthy', providerId: this.providerId };
  }

  async capabilities() {
    return { knowledge: true, memory: false, codeIntelligence: false, skills: false };
  }

  async list() {
    const docsDir = path.join(this.rootDir, 'docs');
    const resources = [];
    if (fs.existsSync(docsDir)) {
      this._walkDocs(docsDir, resources);
    }
    return resources;
  }

  _walkDocs(dir, list) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this._walkDocs(full, list);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relPath = path.relative(this.rootDir, full).replace(/\\/g, '/');
        list.push({ ref: relPath, name: entry.name, size: fs.statSync(full).size });
      }
    }
  }

  async read(ref) {
    const fullPath = path.resolve(this.rootDir, ref);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Knowledge resource not found: ${ref}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { ref, content };
  }

  async query(input = {}) {
    const { text = '' } = input;
    const all = await this.list();
    const results = [];
    const lowerText = text.toLowerCase();

    for (const item of all) {
      if (!text || item.ref.toLowerCase().includes(lowerText)) {
        results.push({ resource: item, score: 1.0 });
      }
    }

    return results;
  }
}

/**
 * Native Repository Code Intelligence Provider
 */
export class NativeCodeIntelligenceProvider extends DKProvider {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || process.cwd();
    this.providerId = 'native-code-intelligence';
    this.displayName = 'DK Native Code Intelligence';
    this.version = '0.7.0';
  }

  async detect() {
    return { providerId: this.providerId, installed: true, available: true, dataLocation: 'local' };
  }

  async health() {
    return { status: 'healthy', providerId: this.providerId };
  }

  async capabilities() {
    return { codeIntelligence: true, memory: false, knowledge: false, skills: false };
  }

  async getFiles(subDir = '') {
    const targetDir = path.resolve(this.rootDir, subDir);
    const files = [];
    if (fs.existsSync(targetDir)) {
      this._walkFiles(targetDir, files);
    }
    return files;
  }

  _walkFiles(dir, list) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this._walkFiles(full, list);
      } else if (entry.isFile()) {
        const relPath = path.relative(this.rootDir, full).replace(/\\/g, '/');
        list.push(relPath);
      }
    }
  }

  async searchSymbols(query = '') {
    const files = await this.getFiles('runtime');
    const matches = files.filter((f) => f.toLowerCase().includes(query.toLowerCase()));
    return matches.map((file) => ({ file, symbol: path.basename(file, path.extname(file)) }));
  }
}
