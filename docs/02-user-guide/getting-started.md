# Getting Started

Welcome to **Development Kit**. Follow this guide to install and run your first development workflow.

---

## Prerequisites

* **Node.js**: Version `>=18.0.0`
* **AI Environment**: Antigravity or OpenCode
* **Package Manager**: `npm` (included with Node.js)

---

## Quick Installation

### Option A: Install into Current Project (Antigravity)
```bash
npx development-kit --project
```

### Option B: Install Globally across All Projects (Antigravity)
```bash
npx development-kit --global
```

### Option C: Install into OpenCode Environment
```bash
npx development-kit --opencode
```

---

## Verifying Installation

Run the doctor script to verify everything is in place:
```bash
npm run doctor
```

Expected output:
```text
Plugin manifest check:
  Skills: 43 defined, 43 available
  Agents: 18 defined, 18 available
  Hooks: 4 defined, 4 available

  ✓ Plugin is in sync
```

---

## Your First Command

In your AI chat assistant, start by checking your workflow status:
```text
/dk-status
```
Or initiate a new feature idea:
```text
/dk-idea
```
