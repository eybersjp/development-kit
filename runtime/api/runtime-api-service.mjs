/**
 * Development Kit Runtime API ? Secure Local HTTP Service
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
import { validateWorkflowState } from '../autopilot/validators.mjs';
import { loadWorkspaceTargetRegistry } from '../orchestration/workspace-targets.mjs';
import { loadCostRecords } from '../orchestration/cost-observatory.mjs';
import { loadDiscoveryEvents } from '../orchestration/discovery-reentry.mjs';
import { MemoryType, MemoryStatus, MemoryAuthority } from '../intelligence/memory-enums.mjs';
import { validateMemoryRecord, validateAuthorityTransition } from '../intelligence/memory-schema.mjs';
import { loadActiveDecisionMenu, resolveDecisionInput } from '../orchestration/decision-menu.mjs';
import { loadIdeaSuggestions } from '../orchestration/idea-suggestions.mjs';
import {
  loadConfigurationRegistry,
  evaluateConfigurationReadiness,
  loadConfigurationGateState,
  recordConfigurationDecision,
  generateConfigurationSetupGuide,
  saveConfigurationGateState,
} from '../orchestration/configuration-readiness.mjs';

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
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => resolve());
      });
    }
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
      // Compare the parsed URL hostname, not a string prefix: an attacker
      // can own "localhost.evil.example" or "127.0.0.1.evil.example".
      // Origin must be a canonical HTTP loopback origin without credentials,
      // path, query, or a spoofed suffix.
      let isLoopbackOrigin = false;
      try {
        const parsedOrigin = new URL(origin);
        isLoopbackOrigin =
          parsedOrigin.protocol === 'http:' &&
          ['127.0.0.1', 'localhost', '[::1]'].includes(parsedOrigin.hostname) &&
          parsedOrigin.username === '' && parsedOrigin.password === '' &&
          parsedOrigin.origin === origin;
      } catch {
        // Treat malformed, opaque, or untrusted origins as remote.
      }

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

    if (method === 'GET' && pathname === '/v1/reliability') {
      const dkDir = path.join(this.rootDir, '.development-kit');
      const contractsDir = path.join(dkDir, 'contracts');
      const runsDir = path.join(dkDir, 'runs');
      const decisionsDir = path.join(dkDir, 'decisions');
      const contracts = fs.existsSync(contractsDir) ? fs.readdirSync(contractsDir) : [];
      const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
      const decisions = fs.existsSync(decisionsDir) ? fs.readdirSync(decisionsDir) : [];

      const workflowState = getCurrentState(this.rootDir);

      return this._json(res, 200, {
        reliabilityControlPlane: true,
        lifecycleStage: workflowState?.stage ?? 'UNDERSTAND',
        currentRevision: workflowState?.revision ?? 0,
        activeTask: workflowState?.activeTask ?? null,
        contractsCount: contracts.length,
        contracts,
        runsCount: runs.length,
        runs,
        decisionsCount: decisions.length,
        decisions,
        executionMediationState: {
          guaranteedInterceptionSupported: false,
          failClosedRequired: true,
        },
      });
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
      let activeMenu = null;
      try {
        activeMenu = loadActiveDecisionMenu(this.rootDir);
      } catch {
        // active menu optional
      }
      let suggestions = [];
      try {
        suggestions = loadIdeaSuggestions(this.rootDir);
      } catch {
        // suggestions optional
      }

      return this._json(res, 200, {
        decisions,
        activeDecision: activeMenu,
        suggestions,
      });
    }

    if (method === 'POST' && pathname === '/v1/decisions/resolve') {
      const body = await this._readJsonBody(req);
      const resolution = resolveDecisionInput({
        input: body.input ?? body.selectedNumber,
        rootDir: this.rootDir,
        authority: body.authority || 'Product Owner',
      });
      if (!resolution.success) {
        return this._json(res, 400, { error: 'Resolution Failed', ...resolution });
      }
      return this._json(res, 200, resolution);
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

    if (method === 'GET' && pathname === '/v1/scale-context') {
      // Read-only projection over v0.11's supported state authority. T04's
      // canonical event ledger is deliberately NOT included in v0.12.
      const directory = path.join(this.rootDir, '.development-kit', 'autopilot', 'state');
      const pointerPath = path.join(directory, 'current.json');
      let stateHealth = 'unavailable';
      let state = { active: false, currentStage: null, revision: null };
      if (fs.existsSync(pointerPath)) {
        try {
          const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
          if (!Number.isSafeInteger(pointer.currentRevision) ||
              !/^revision-\d{6}\.json$/.test(pointer.currentRevisionFile) ||
              Number(pointer.currentRevisionFile.slice(9, 15)) !== pointer.currentRevision) {
            throw new Error('Invalid revision pointer');
          }
          const revisionPath = path.join(directory, pointer.currentRevisionFile);
          if (!fs.existsSync(revisionPath)) {
            stateHealth = 'recovery-required';
          } else {
            const revision = JSON.parse(fs.readFileSync(revisionPath, 'utf8'));
            validateWorkflowState(revision);
            if (revision.stateRevision !== pointer.currentRevision) {
              throw new Error('Pointer revision mismatch');
            }
            stateHealth = 'unverified';
            state = { active: true, currentStage: revision.currentStage, revision: revision.stateRevision };
          }
        } catch {
          stateHealth = 'degraded';
        }
      }
      const modules = {
        workspaceTargets: 'workspace-targets.mjs',
        executionCapsules: 'execution-capsule.mjs',
        lifecycleInstances: 'lifecycle-instance.mjs',
        discoveryReentry: 'discovery-reentry.mjs',
        gateProfiles: 'gate-profiles.mjs',
        verificationExtensionSdk: 'verification-extension-sdk.mjs',
        complexityDeltaGuard: 'complexity-delta.mjs',
      };
      const capabilities = Object.fromEntries(Object.entries(modules).map(([id, filename]) => [
        id, { installed: fs.existsSync(new URL('../orchestration/' + filename, import.meta.url)),
          accepted: null, acceptanceStatus: 'not-independently-established' },
      ]));
      capabilities.stateEngineV2 = {
        installed: false, accepted: false, acceptanceStatus: 'deferred-to-v0.13.0',
      };
      // Operational state is observed strictly from the existing stable
      // project stores. Never confuse an installed module with an active,
      // verified, or accepted capability, and never mutate data on GET.
      const observe = (read) => {
        try { return { status: 'available', ...read() }; }
        catch { return { status: 'degraded' }; }
      };
      const operational = {
        workspaceTargets: observe(() => {
          const registry = loadWorkspaceTargetRegistry(this.rootDir, { required: false });
          return registry ? {
            status: 'available', count: Object.keys(registry.targets || {}).length,
            targetIds: Object.keys(registry.targets || {}).sort(),
          } : { status: 'unavailable', count: 0 };
        }),
        costObservatory: observe(() => {
          const ledger = path.join(this.rootDir, '.development-kit', 'telemetry', 'cost-records.jsonl');
          if (!fs.existsSync(ledger)) return { status: 'unavailable', count: 0 };
          const records = loadCostRecords(this.rootDir);
          return { status: 'available', count: records.length };
        }),
        discoveryQueue: observe(() => {
          const directory = path.join(this.rootDir, '.development-kit', 'discovery', 'events');
          if (!fs.existsSync(directory)) return { status: 'unavailable', count: 0 };
          const events = loadDiscoveryEvents(this.rootDir);
          return { status: 'available', count: events.length,
            pendingApproval: events.filter(event => event.requiresHumanApproval).length };
        }),
        lifecycleInstances: {
          status: stateHealth === 'unverified' ? 'available' : stateHealth,
          count: state.active ? 1 : 0,
          currentStage: state.currentStage,
          revision: state.revision,
        },
        contextCache: observe(() => {
          const directory = path.join(this.rootDir, '.development-kit', 'cache', 'context');
          if (!fs.existsSync(directory)) return { status: 'unavailable', entryCount: 0 };
          let entries = 0;
          const walk = (dir) => {
            for (const node of fs.readdirSync(dir, { withFileTypes: true })) {
              if (node.isSymbolicLink()) continue;
              if (node.isDirectory()) walk(path.join(dir, node.name));
              else if (node.isFile() && node.name.endsWith('.json')) entries++;
            }
          };
          walk(directory);
          return { status: 'available', entryCount: entries, freshness: 'unverified' };
        }),
        effectiveGates: { status: 'unavailable', reason: 'no-source-bound-active-contract' },
      };
      return this._json(res, 200, {
        schemaVersion: '1.0.0',
        canonicalStateStore: 'autopilot-versioned-snapshots',
        stateHealth,
        state,
        capabilities,
        operational,
        authority: 'read-only-projection',
        acceptanceAuthority: 'canonical-deterministic-gates',
      });
    }

    if (method === 'GET' && pathname === '/v1/configuration-readiness') {
      const reg = loadConfigurationRegistry(this.rootDir);
      const gate = evaluateConfigurationReadiness({
        rootDir: this.rootDir,
        requirements: reg.requirements,
      });
      // Metadata only - NEVER expose credentials
      const safeRequirements = reg.requirements.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        provider: r.provider,
        status: r.status,
        requiredBy: r.requiredBy,
        requiredByTasks: r.requiredByTasks,
        requiredByCriteria: r.requiredByCriteria,
        target: r.target ? {
          type: r.target.type,
          file: r.target.file,
          variable: r.target.variable,
          line: r.target.line,
        } : null,
        description: r.description,
      }));

      return this._json(res, 200, {
        gate,
        requirements: safeRequirements,
        setupGuidePath: '.development-kit/SECRETS_SETUP.md',
      });
    }

    if (method === 'POST' && pathname === '/v1/configuration-readiness/decision') {
      const body = await this._readJsonBody(req);
      const result = recordConfigurationDecision({
        rootDir: this.rootDir,
        requirementId: body.requirementId,
        decision: body.decision,
        confirmed: body.confirmed !== false,
        contractId: body.contractId || null,
        sourceFingerprint: body.sourceFingerprint || null,
        authority: body.authority || 'Product Owner',
      });
      const reg = loadConfigurationRegistry(this.rootDir);
      const gate = evaluateConfigurationReadiness({
        rootDir: this.rootDir,
        requirements: reg.requirements,
      });
      saveConfigurationGateState(gate, this.rootDir);
      generateConfigurationSetupGuide(this.rootDir, reg.requirements);
      return this._json(res, 200, { result, gate });
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
