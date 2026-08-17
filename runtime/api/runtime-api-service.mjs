/**
 * Development Kit Runtime API — Secure Local HTTP Service
 *
 * Implements local loopback HTTP service providing read and governed write surfaces
 * for DK Control Center, IDE extensions, and CLI tools.
 *
 * Security:
 * - Loopback bound (127.0.0.1)
 * - Session capability token header (X-DK-Session-Token)
 * - Strict CORS / Anti-CSRF protection
 * - Read-only by default, governed writes require valid token & origin
 * - No secrets exposed in responses
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

import { resolveMemoryIdentity } from '../intelligence/memory-identity.mjs';
import { resolveEffectiveSettings } from '../intelligence/settings.mjs';
import { LocalMemoryProvider } from '../intelligence/local-memory-provider.mjs';
import { getCurrentState } from '../autopilot/state-store.mjs';
import { MemoryType, MemoryStatus, MemoryAuthority } from '../intelligence/memory-enums.mjs';
import { validateMemoryRecord, validateAuthorityTransition } from '../intelligence/memory-schema.mjs';

export class RuntimeApiService {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.port = options.port || 0; // 0 for random available port in tests/auto
    this.host = options.host || '127.0.0.1';
    this.sessionToken = options.sessionToken || `dkt_${crypto.randomUUID()}`;
    this.memoryProvider = options.memoryProvider || new LocalMemoryProvider({ rootDir: this.rootDir });
    this.server = null;
    this.boundPort = null;
  }

  async start() {
    await this.memoryProvider.activate();

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this._handleRequest(req, res);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
        }
      });

      this.server.on('error', reject);

      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address();
        this.boundPort = typeof addr === 'object' && addr !== null ? addr.port : this.port;
        resolve({
          host: this.host,
          port: this.boundPort,
          sessionToken: this.sessionToken,
          url: `http://${this.host}:${this.boundPort}`,
        });
      });
    });
  }

  async stop() {
    const server = this.server;
    if (!server) return;

    // Detach the instance immediately so repeated stop() calls are idempotent.
    this.server = null;
    this.boundPort = null;

    if (!server.listening) return;

    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });

      // A local Control Center shutdown is terminal for this server instance.
      // Do not allow pooled/keep-alive loopback clients to keep the process alive.
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    });
  }

  async _handleRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Set Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');

    // CORS Handling (Deny-by-default, allow loopback Control Center)
    const origin = req.headers.origin;
    if (origin) {
      const isLoopbackOrigin =
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith(`http://[::1]`);

      if (!isLoopbackOrigin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden', message: 'Cross-origin request rejected' }));
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-DK-Session-Token');
    }

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Protect non-GET requests with session token verification
    if (method !== 'GET') {
      const clientToken = req.headers['x-dk-session-token'];
      if (!clientToken || clientToken !== this.sessionToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing X-DK-Session-Token' }));
        return;
      }
    }

    // Route dispatch
    if (method === 'GET' && pathname === '/v1/status') {
      return this._json(res, 200, await this._getStatus());
    }

    if (method === 'GET' && pathname === '/v1/health') {
      return this._json(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
    }

    if (method === 'GET' && pathname === '/v1/project') {
      const identity = resolveMemoryIdentity(this.rootDir);
      const settings = resolveEffectiveSettings(this.rootDir);
      return this._json(res, 200, { identity, settings });
    }

    if (method === 'GET' && pathname === '/v1/workflow') {
      const state = getCurrentState(this.rootDir);
      return this._json(res, 200, { state: state || null });
    }

    if (method === 'GET' && pathname === '/v1/memory') {
      const records = await this.memoryProvider.listAllRecords();
      return this._json(res, 200, { records });
    }

    if (method === 'GET' && pathname.startsWith('/v1/memory/')) {
      const id = pathname.replace('/v1/memory/', '');
      const record = await this.memoryProvider.get(id);
      if (!record) {
        return this._json(res, 404, { error: 'Not Found', message: `Record ${id} not found` });
      }
      return this._json(res, 200, { record });
    }

    if (method === 'POST' && pathname === '/v1/memory/query') {
      const body = await this._readJsonBody(req);
      const results = await this.memoryProvider.query(body);
      return this._json(res, 200, { results });
    }

    if (method === 'GET' && pathname === '/v1/decisions') {
      const queryResults = await this.memoryProvider.query({ types: [MemoryType.DECISION] });
      const decisions = queryResults.map((r) => r.record);
      return this._json(res, 200, { decisions });
    }

    if (method === 'GET' && pathname === '/v1/providers') {
      const health = await this.memoryProvider.health();
      const detect = await this.memoryProvider.detect();
      const capabilities = await this.memoryProvider.capabilities();
      return this._json(res, 200, {
        providers: [
          {
            providerId: this.memoryProvider.providerId,
            displayName: this.memoryProvider.displayName,
            version: this.memoryProvider.version,
            health,
            detect,
            capabilities,
          },
        ],
      });
    }

    if (method === 'GET' && pathname === '/v1/settings') {
      const effective = resolveEffectiveSettings(this.rootDir);
      return this._json(res, 200, { settings: effective });
    }

    // Governed memory write endpoints
    if (method === 'POST' && pathname === '/v1/memory') {
      const body = await this._readJsonBody(req);
      validateMemoryRecord(body);
      const stored = await this.memoryProvider.store(body);
      return this._json(res, 201, { record: stored });
    }

    if (method === 'PATCH' && pathname.startsWith('/v1/memory/')) {
      const id = pathname.replace('/v1/memory/', '');
      const body = await this._readJsonBody(req);
      const existing = await this.memoryProvider.get(id);
      if (!existing) {
        return this._json(res, 404, { error: 'Not Found', message: `Record ${id} not found` });
      }

      const userConfirmed = Boolean(body.userConfirmed);
      const updatedRecord = { ...existing, ...body.record, id, updatedAt: new Date().toISOString() };
      validateMemoryRecord(updatedRecord);
      validateAuthorityTransition(existing, updatedRecord, userConfirmed);

      const saved = await this.memoryProvider.update(updatedRecord, { userConfirmed });
      return this._json(res, 200, { record: saved });
    }

    if (method === 'POST' && pathname.endsWith('/supersede') && pathname.startsWith('/v1/memory/')) {
      const id = pathname.replace('/v1/memory/', '').replace('/supersede', '');
      const body = await this._readJsonBody(req);
      const result = await this.memoryProvider.supersede(id, body);
      return this._json(res, 200, result);
    }

    if (method === 'POST' && pathname.endsWith('/archive') && pathname.startsWith('/v1/memory/')) {
      const id = pathname.replace('/v1/memory/', '').replace('/archive', '');
      const archived = await this.memoryProvider.archive(id);
      return this._json(res, 200, { record: archived });
    }

    if (method === 'DELETE' && pathname.startsWith('/v1/memory/')) {
      const id = pathname.replace('/v1/memory/', '');
      await this.memoryProvider.forget(id);
      return this._json(res, 200, { success: true, forgotten: id });
    }

    // Candidate routes
    if (method === 'POST' && pathname.startsWith('/v1/memory-candidates/') && pathname.endsWith('/promote')) {
      const candidateId = pathname.replace('/v1/memory-candidates/', '').replace('/promote', '');
      const body = await this._readJsonBody(req);
      const { promoteCandidateToRecord } = await import('../intelligence/candidate-extraction.mjs');
      const candidate = body.candidate || { candidateId, ...body };
      const userConfirmed = Boolean(body.userConfirmed);
      if (body.targetAuthority === MemoryAuthority.USER_APPROVED && !userConfirmed) {
        return this._json(res, 400, { error: 'Bad Request', message: 'Explicit user confirmation required to promote to user-approved' });
      }
      const record = promoteCandidateToRecord(candidate, {
        authority: body.targetAuthority || candidate.proposedAuthority,
      });
      const stored = await this.memoryProvider.store(record);
      return this._json(res, 200, { candidateId, status: 'promoted', record: stored });
    }

    if (method === 'POST' && pathname.startsWith('/v1/memory-candidates/') && pathname.endsWith('/reject')) {
      const candidateId = pathname.replace('/v1/memory-candidates/', '').replace('/reject', '');
      return this._json(res, 200, { candidateId, status: 'rejected' });
    }

    // Settings update
    if (method === 'PATCH' && pathname === '/v1/settings') {
      const body = await this._readJsonBody(req);
      const { validateSettings, getProjectSettingsPath } = await import('../intelligence/settings.mjs');
      validateSettings(body);
      const projectSettingsPath = getProjectSettingsPath(this.rootDir);
      const dir = path.dirname(projectSettingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let existingSettings = {};
      if (fs.existsSync(projectSettingsPath)) {
        try { existingSettings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8')); } catch {}
      }
      const merged = { ...existingSettings, ...body };
      fs.writeFileSync(projectSettingsPath, JSON.stringify(merged, null, 2), 'utf8');
      const effective = resolveEffectiveSettings(this.rootDir);
      return this._json(res, 200, { settings: effective });
    }

    // Default 404
    return this._json(res, 404, { error: 'Not Found', message: `Route ${method} ${pathname} not found` });
  }

  async _getStatus() {
    const identity = resolveMemoryIdentity(this.rootDir);
    const settings = resolveEffectiveSettings(this.rootDir);
    const state = getCurrentState(this.rootDir);
    const records = await this.memoryProvider.listAllRecords();

    return {
      runtimeVersion: '0.7.0',
      frameworkVersion: '0.6.1',
      identity,
      settings,
      workflow: {
        active: Boolean(state),
        currentStage: state ? state.currentStage : null,
        workflowStatus: state ? state.workflowStatus : null,
      },
      intelligence: {
        activeMemoryCount: records.filter((r) => r.status === MemoryStatus.ACTIVE).length,
        totalMemoryCount: records.length,
        defaultProvider: settings.intelligence.defaultProvider,
      },
    };
  }

  _json(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  _readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          req.destroy(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Malformed JSON: ${err.message}`));
        }
      });
      req.on('error', reject);
    });
  }
}
