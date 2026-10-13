/**
 * Development Kit Control Center — Local Web Interface Application
 *
 * Implements clean, zero-external-dependency HTML/CSS/JS single-page application
 * served by the DK local web service for Overview, Workflow, Memory, Decisions,
 * Providers, and Settings.
 */

export function renderControlCenterHtml(config = {}) {
  const { sessionToken = '', apiBaseUrl = '', host = '127.0.0.1', port = 3200 } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Development Kit Control Center</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --card-border: #30363d;
      --text: #c9d1d9;
      --text-bright: #f0f6fc;
      --text-muted: #8b949e;
      --primary: #58a6ff;
      --primary-hover: #1f6feb;
      --success: #3fb950;
      --warning: #d29922;
      --danger: #f85149;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar Navigation */
    aside {
      width: 240px;
      background-color: var(--card-bg);
      border-right: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 18px 20px;
      font-weight: 600;
      font-size: 15px;
      color: var(--text-bright);
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      font-size: 11px;
      padding: 2px 6px;
      background: #238636;
      color: white;
      border-radius: 12px;
      font-family: var(--font-mono);
    }
    nav {
      padding: 16px 12px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text);
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-size: 13px;
    }
    .nav-item:hover { background-color: rgba(177, 186, 196, 0.12); color: var(--text-bright); }
    .nav-item.active { background-color: rgba(56, 139, 253, 0.15); color: var(--primary); font-weight: 600; }

    /* Main Container */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      padding: 14px 24px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--card-bg);
    }
    .project-title { font-size: 16px; font-weight: 600; color: var(--text-bright); }
    .status-pill {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 12px;
      font-family: var(--font-mono);
      background: rgba(56, 139, 253, 0.15);
      color: var(--primary);
      border: 1px solid rgba(56, 139, 253, 0.4);
    }

    .content-area {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }

    /* Grid & Cards */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 18px;
    }
    .card-header {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-bright);
      font-family: var(--font-mono);
    }

    /* Data Tables */
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--card-border); }
    th { font-size: 12px; color: var(--text-muted); text-transform: uppercase; }
    td { font-size: 13px; }
    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--font-mono);
      background: rgba(110, 118, 129, 0.2);
    }
    .tag.user-approved { background: rgba(63, 185, 80, 0.2); color: var(--success); }
    .tag.inferred { background: rgba(210, 153, 34, 0.2); color: var(--warning); }

    /* Forms */
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 500; margin-bottom: 6px; font-size: 13px; color: var(--text-bright); }
    select, input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      background-color: var(--bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      color: var(--text-bright);
      font-family: inherit;
      font-size: 13px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid transparent;
      background: var(--primary);
      color: white;
    }
    .btn:hover { background: var(--primary-hover); }
  </style>
</head>
<body>
  <aside>
    <div class="brand">
      <span>DK Control Center</span>
      <span class="brand-badge" id="framework-badge">Version unknown</span>
    </div>
    <nav>
      <button class="nav-item active" data-view="overview" onclick="switchView('overview')">Overview</button>
      <button class="nav-item" data-view="workflow" onclick="switchView('workflow')">Workflow</button>
      <button class="nav-item" data-view="scale-context" onclick="switchView('scale-context')">Scale &amp; Context</button>
      <button class="nav-item" data-view="memory" onclick="switchView('memory')">Memory</button>
      <button class="nav-item" data-view="decisions" onclick="switchView('decisions')">Decisions</button>
      <button class="nav-item" data-view="configuration" onclick="switchView('configuration')">Configuration</button>
      <button class="nav-item" data-view="providers" onclick="switchView('providers')">Providers</button>
      <button class="nav-item" data-view="settings" onclick="switchView('settings')">Settings</button>
    </nav>
  </aside>

  <main>
    <header>
      <div class="project-title" id="proj-header-title">Development Kit Workspace</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span id="refresh-indicator" role="status" aria-live="polite">Connecting</span><button class="btn" onclick="refreshNow()" type="button">Refresh now</button><div class="status-pill" id="lifecycle-pill">STAGE: UNKNOWN</div></div>
    </header>

    <div class="content-area" id="main-content">
      <!-- Injected Views -->
    </div>
  </main>

  <script>
    const SESSION_TOKEN = "${sessionToken}";
    const API_BASE = "${apiBaseUrl}";
    let currentView = 'overview';
    let cachedStatus = null;
    let refreshing = false;
    let refreshQueued = false;

    async function apiFetch(path, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        'X-DK-Session-Token': SESSION_TOKEN,
        ...(options.headers || {})
      };
      const res = await fetch(API_BASE + path, { cache: 'no-store', ...options, headers });
      if (!res.ok) throw new Error(\`API error: \${res.status}\`);
      return res.json();
    }

    async function refreshStatus() {
      const status = await apiFetch('/v1/status');
      cachedStatus = status;
      document.getElementById('proj-header-title').textContent = status.identity?.projectId || 'Unconfigured project';
      document.getElementById('lifecycle-pill').textContent = 'STAGE: ' + (status.workflow?.currentStage || 'IDLE');
      document.getElementById('framework-badge').textContent = status.frameworkVersion ? 'v' + status.frameworkVersion : 'Version unknown';
    }

    async function switchView(viewName) {
      currentView = viewName;
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-view') === viewName);
      });
      await refreshNow();
    }

    async function renderView() {
      const content = document.getElementById('main-content');
      const previousScrollTop = content.scrollTop;
      await refreshStatus();

      if (currentView === 'overview') {
        content.innerHTML = \`
          <div class="grid">
            <div class="card">
              <div class="card-header">Current Lifecycle Stage</div>
              <div class="card-value">\${cachedStatus.workflow.currentStage || 'UNDERSTAND'}</div>
            </div>
            <div class="card">
              <div class="card-header">Active Memory Records</div>
              <div class="card-value">\${cachedStatus.intelligence.activeMemoryCount}</div>
            </div>
            <div class="card">
              <div class="card-header">Memory Provider</div>
              <div class="card-value">\${cachedStatus.intelligence.defaultProvider}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Project Context</div>
            <p><strong>Project ID:</strong> \${cachedStatus.identity.projectId}</p>
            <p><strong>Workspace ID:</strong> \${cachedStatus.identity.workspaceId}</p>
            <p><strong>Auto-Open Setting:</strong> \${cachedStatus.settings.controlCenter.autoOpen ? 'On' : 'Off'}</p>
          </div>
        \`;
      } else if (currentView === 'memory') {
        const memData = await apiFetch('/v1/memory');
        const rows = memData.records.map(r => \`
          <tr>
            <td>\${r.id}</td>
            <td><span class="tag">\${r.type}</span></td>
            <td><strong>\${r.subject}</strong></td>
            <td>\${r.content}</td>
            <td><span class="tag \${r.authority}">\${r.authority}</span></td>
            <td>\${r.status}</td>
          </tr>
        \`).join('');

        content.innerHTML = \`
          <div class="card">
            <div class="card-header">All Memory Records (\${memData.records.length})</div>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Type</th><th>Subject</th><th>Content</th><th>Authority</th><th>Status</th>
                </tr>
              </thead>
              <tbody>\${rows || '<tr><td colspan="6">No memory records found.</td></tr>'}</tbody>
            </table>
          </div>
        \`;
      } else if (currentView === 'decisions') {
        const decData = await apiFetch('/v1/decisions');
        const rows = decData.decisions.map(d => \`
          <tr>
            <td>\${d.id}</td>
            <td><strong>\${d.subject}</strong></td>
            <td>\${d.content}</td>
            <td><span class="tag \${d.authority}">\${d.authority}</span></td>
            <td>\${d.source?.ref || 'Direct'}</td>
          </tr>
        \`).join('');

        content.innerHTML = \`
          <div class="card">
            <div class="card-header">Authoritative Architecture Decisions (\${decData.decisions.length})</div>
            <table>
              <thead>
                <tr><th>ID</th><th>Subject</th><th>Decision</th><th>Authority</th><th>Source</th></tr>
              </thead>
              <tbody>\${rows || '<tr><td colspan="5">No recorded decisions yet.</td></tr>'}</tbody>
            </table>
          </div>
        \`;
      } else if (currentView === 'workflow') {
        const wfData = await apiFetch('/v1/workflow');
        const stages = ['UNDERSTAND', 'DEFINE', 'DESIGN', 'PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'SIMPLIFY', 'COMPLETE'];
        const stagePills = stages.map(s => {
          const isCurrent = wfData.state && wfData.state.currentStage === s;
          const isDone = wfData.state && wfData.state.completedStages && wfData.state.completedStages.includes(s);
          const color = isCurrent ? 'var(--primary)' : isDone ? 'var(--success)' : 'var(--text-muted)';
          return \`<div class="card" style="border-left: 4px solid \${color}; margin-bottom: 8px;">
            <strong>\${s}</strong> \${isCurrent ? '(Active)' : isDone ? '(Completed)' : ''}
          </div>\`;
        }).join('');

        content.innerHTML = \`
          <div class="card" style="margin-bottom: 16px;">
            <div class="card-header">9-Stage Autopilot Lifecycle</div>
            \${stagePills}
          </div>
        \`;
      } else if (currentView === 'scale-context') {
        const scale = await apiFetch('/v1/scale-context');
        const makeCard = (label, value) => {
          const card = document.createElement('div'); card.className = 'card';
          const heading = document.createElement('div'); heading.className = 'card-header'; heading.textContent = label;
          const body = document.createElement('div'); body.className = 'card-value'; body.textContent = String(value ?? 'Unavailable');
          card.append(heading, body); return card;
        };
        const grid = document.createElement('div'); grid.className = 'grid';
        grid.append(
          makeCard('State health', scale.stateHealth),
          makeCard('Lifecycle stage', scale.state?.currentStage || 'None active'),
          makeCard('State revision', scale.state?.revision ?? 'Not available'));
        const authority = document.createElement('div'); authority.className = 'card';
        authority.style.marginBottom = '16px';
        const authorityHeading = document.createElement('div'); authorityHeading.className = 'card-header';
        authorityHeading.textContent = 'State authority';
        const authorityText = document.createElement('p');
        authorityText.textContent = (scale.canonicalStateStore || 'Unknown') + ' / ' + (scale.authority || 'Unverified');
        authority.append(authorityHeading, authorityText);
        const makeTable = (title, records, columns) => {
          const card = document.createElement('div'); card.className = 'card'; card.style.marginBottom = '16px';
          const heading = document.createElement('div'); heading.className = 'card-header'; heading.textContent = title;
          const table = document.createElement('table');
          const thead = document.createElement('thead'); const hrow = document.createElement('tr');
          for (const column of columns) { const cell = document.createElement('th'); cell.textContent = column; hrow.appendChild(cell); }
          thead.appendChild(hrow); table.appendChild(thead);
          const tbody = document.createElement('tbody');
          for (const row of records) { const tr = document.createElement('tr');
            for (const value of row) { const td = document.createElement('td'); td.textContent = String(value ?? '—'); tr.appendChild(td); }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody); card.append(heading, table); return card;
        };
        const operational = Object.entries(scale.operational || {}).map(([name, state]) => [
          name, state?.status || 'unverified',
          state?.count ?? state?.entryCount ?? state?.revision ?? state?.reason ?? '—'
        ]);
        const capabilities = Object.entries(scale.capabilities || {}).map(([name, info]) => [
          name, info?.installed ? 'Installed' : 'Not installed',
          info?.acceptanceStatus || (info?.accepted === true ? 'Accepted' : info?.accepted === false ? 'Not accepted' : 'Unverified')
        ]);
        content.replaceChildren(grid, authority,
          makeTable('Observed operational state', operational, ['Capability', 'State', 'Observed detail']),
          makeTable('Capability and acceptance', capabilities, ['Capability', 'Installation', 'Acceptance']));
      } else if (currentView === 'configuration') {
        const configData = await apiFetch('/v1/configuration-readiness');
        const gate = configData.gate;
        const reqs = configData.requirements || [];

        const statusIcon = (st) => {
          if (st === 'VALID') return '<span style="color: var(--success)">✓ VALID</span>';
          if (st === 'CONFIGURED') return '<span style="color: var(--primary)">○ CONFIGURED</span>';
          if (st === 'DEFERRED_BY_PRODUCT_OWNER') return '<span style="color: var(--warning)">! DEFERRED</span>';
          if (st === 'INVALID') return '<span style="color: var(--danger)">× INVALID</span>';
          return '<span style="color: var(--danger)">× MISSING</span>';
        };

        const rows = reqs.map(r => \`
          <tr>
            <td><strong>\${r.id}</strong></td>
            <td>\${r.name}</td>
            <td>\${r.provider}</td>
            <td><span class="tag">\${r.kind}</span></td>
            <td>\${statusIcon(r.status)}</td>
            <td>\${r.requiredBy}</td>
            <td>\${r.requiredByTasks?.join(', ') || '—'}</td>
            <td>\${r.target?.file || r.target?.type || '—'}</td>
          </tr>
        \`).join('');

        content.innerHTML = \`
          <div class="grid" style="margin-bottom: 16px;">
            <div class="card">
              <div class="card-header">Gate State</div>
              <div class="card-value" style="font-size: 18px;">\${gate.state}</div>
            </div>
            <div class="card">
              <div class="card-header">Total Requirements</div>
              <div class="card-value">\${gate.counts?.total || reqs.length}</div>
            </div>
            <div class="card">
              <div class="card-header">Valid / Missing / Deferred</div>
              <div class="card-value" style="font-size: 18px;">
                \${gate.counts?.valid || 0} / \${gate.counts?.missing || 0} / \${gate.counts?.deferred || 0}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Configuration Readiness (\${reqs.length})</div>
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Provider</th><th>Type</th><th>Status</th><th>Required By</th><th>Task</th><th>Location</th></tr>
              </thead>
              <tbody>\${rows || '<tr><td colspan="8">No configuration requirements registered.</td></tr>'}</tbody>
            </table>
          </div>
        \`;
      } else if (currentView === 'providers') {
        const provData = await apiFetch('/v1/providers');
        const cards = provData.providers.map(p => \`
          <div class="card" style="margin-bottom: 16px;">
            <div class="card-header">\${p.displayName} (\${p.providerId})</div>
            <p><strong>Status:</strong> \${p.health.status}</p>
            <p><strong>Version:</strong> \${p.version}</p>
            <p><strong>Data Location:</strong> \${p.detect.dataLocation}</p>
          </div>
        \`).join('');

        content.innerHTML = cards;
      } else if (currentView === 'settings') {
        const setData = await apiFetch('/v1/settings');
        content.innerHTML = \`
          <div class="card">
            <div class="card-header">Effective Settings</div>
            <p><strong>Automatically Open Control Center:</strong> \${setData.settings.controlCenter.autoOpen ? 'On' : 'Off'}</p>
            <p><strong>Default Memory Provider:</strong> \${setData.settings.intelligence.defaultProvider}</p>
            <p><strong>Context Budget Tokens:</strong> \${setData.settings.intelligence.contextBudgetTokens}</p>
          </div>
        \`;
      }
      content.scrollTop = previousScrollTop;
    }

    async function refreshNow() {
      if (refreshing) { refreshQueued = true; return; }
      refreshing = true;
      try {
        await renderView();
        document.getElementById('refresh-indicator').textContent = 'Updated ' + new Date().toLocaleTimeString();
      } catch (err) {
        console.error('Control Center refresh failed', err);
        document.getElementById('lifecycle-pill').textContent = 'STAGE: UNAVAILABLE';
        document.getElementById('refresh-indicator').textContent = 'Update failed';
        document.getElementById('main-content').textContent = 'Unable to load live Control Center state. Check the local runtime and refresh.';
      } finally {
        refreshing = false;
        if (refreshQueued) { refreshQueued = false; void refreshNow(); }
      }
    }

    // Initial render and automatic polling of the read-only runtime projection.
    void refreshNow();
    setInterval(() => { if (!document.hidden) void refreshNow(); }, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshNow(); });
  </script>
</body>
</html>`;
}
