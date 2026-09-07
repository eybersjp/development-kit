# DKF Strategic Direction

## The reliability control plane for agentic software development

**Product promise:** **AI can write it. DKF proves it.**

Development Kit Framework (DKF) is evolving from a disciplined AI software-development workflow into an **agent-independent reliability control plane for agentic software development**.

The framework's long-term purpose is not to compete on the number of agents, commands, prompts, or workflow stages. Its purpose is to answer a harder engineering question:

> **When an AI agent says a software change is complete, what evidence proves that the change is authorized, current, traceable, independently verified, safe, and actually acceptable?**

That is the category DKF is designed to own.

---

## 1. Current baseline: v0.10

The current released baseline is **v0.10.0**.

DKF already includes the foundations of the reliability-control-plane model:

- fingerprinted **Development Contracts** binding approved work to authoritative sources;
- **independent verification** that does not treat an implementation agent's completion narrative as authoritative proof;
- deterministic `ACCEPTED`, `PENDING`, and `BLOCKED` acceptance states;
- required-control and reviewer coverage;
- architecture-drift detection;
- source-freshness validation;
- execution-safety and blast-radius controls;
- bounded correction loops;
- DKF Design Authority for frontend visual governance;
- durable engineering intelligence and memory;
- the local DK Control Center;
- a Numbered Decision Interface for deterministic Product Owner choices;
- adversarial regression coverage based on real development failures.

These are implemented capabilities. The roadmap below describes the next evolution and must not be interpreted as functionality already present in v0.10.

---

## 2. Category position

Many AI development tools help an agent decide **what to build** and **what to do next**.

DKF's target position is different:

> **DKF determines whether AI-produced work is allowed to be considered complete.**

The implementation agent is an executor, not the trust authority.

A mature DKF change should be traceable through a chain such as:

```text
User Decision
      ↓
Requirement
      ↓
Design / Architecture Authority
      ↓
Task
      ↓
Code Change
      ↓
Verification
      ↓
Evidence
      ↓
Review
      ↓
Acceptance
```

If a required link is missing, stale, superseded, unauthorized, or unverified, the change must not be accepted.

---

## 3. Locked engineering principles

### 3.1 Completion is computed, never asserted

An agent report saying "done" has no authority to create an accepted state.

Acceptance must be derived from validated evidence, required controls, source freshness, reviews, approvals, policy, architecture/design constraints, and traceability.

### 3.2 Safety should come from proof, not unnecessary ceremony

The current fixed lifecycle was an effective reliability foundation, but the target architecture is **adaptive reliability**.

A bounded low-risk bug fix should not require the same ceremony as a security-sensitive architecture migration.

The future model is:

> **Safety by deterministically proving which controls are required.**

Adaptive workflow depth must never permit mandatory safety controls to disappear because an LLM decided they were inconvenient.

### 3.3 Policy is structured authority

Human-readable guidance is useful, but lifecycle and acceptance requirements should resolve to structured, deterministic policy state.

The target policy hierarchy is:

```text
DKF Core Policy
      ↓
Organisation Policy
      ↓
Repository Policy
      ↓
Task / Contract Requirements
```

Higher layers may strengthen requirements. Mandatory DKF safety controls must fail closed rather than silently disappear.

### 3.4 Evidence quality matters

The roadmap moves beyond checking whether evidence merely exists.

Higher-risk requirements should demand stronger evidence, for example executed tests, runtime observations, browser/API verification, static analysis, independent reproduction, or deterministic external controls rather than narrative review alone.

### 3.5 Authority and provenance are first-class software assets

DKF should be able to explain:

- why a requirement exists;
- who or what authorized it;
- which task implemented it;
- which code changed;
- what evidence verified it;
- which policy applied;
- which risks were accepted and by whom;
- whether any authoritative input changed after verification.

### 3.6 Agent independence

DKF should govern work regardless of which capable coding agent performs it.

Antigravity, OpenCode, Claude Code, Cursor, GitHub Copilot, Cline, Windsurf, and future agents are execution environments. They must not become DKF's source of truth.

### 3.7 Fewer, clearer capability boundaries

DKF does not need to win by continuously increasing its agent or skill count.

New roles, commands, skills, providers, or abstractions should only be introduced when an existing capability boundary genuinely cannot represent the responsibility.

### 3.8 The Control Center is a flight recorder, not Jira

DK Control Center should prioritize engineering observability and governance:

- current change and contract state;
- Authority Graph;
- evidence and verification state;
- policy evaluation;
- lifecycle compilation;
- task dependency graph;
- risk and approval history;
- source staleness;
- agent/run provenance;
- acceptance state and proof certificate.

Generic project-management features are outside the primary product boundary unless they directly support engineering assurance.

---

## 4. Target architecture

The mature architecture is intended to converge on the following model:

```text
                        USER / PRODUCT OWNER
                                │
                                ▼
                     ┌──────────────────────┐
                     │  DECISION INTERFACE  │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ CHANGE INTELLIGENCE  │
                     │ scope · risk · impact│
                     └──────────┬───────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   LIFECYCLE COMPILER   │
                    │ policy → required flow │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ DEVELOPMENT / CHANGE   │
                    │       CONTRACTS        │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             CONTEXT ENGINE             TASK DAG
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    ┌────────────────────────┐
                    │    EXECUTION BROKER    │
                    │ worktree · sandbox     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │     EVIDENCE STORE     │
                    └───────────┬────────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
            INDEPENDENT VERIFY       REVIEW ENGINE
                     │                     │
                     └──────────┬──────────┘
                                ▼
                     ┌──────────────────────┐
                     │   AUTHORITY GRAPH    │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  ACCEPTANCE ENGINE   │
                     └──────────┬───────────┘
                                │
                      ┌─────────┼──────────┐
                      ▼         ▼          ▼
                   BLOCKED   PENDING    ACCEPTED
                                           │
                                           ▼
                                  PROOF CERTIFICATE
                                           │
                                           ▼
                                     PR / RELEASE
```

See [ROADMAP.md](ROADMAP.md) for the planned release sequence.

---

## 5. Product boundary

DKF should own:

- intent and decision authority;
- specification and contract binding;
- context isolation;
- execution governance;
- evidence and verification;
- policy and required controls;
- risk and approvals;
- provenance and traceability;
- deterministic acceptance.

DKF should avoid becoming a replacement for general-purpose issue tracking, team chat, timesheets, roadmaps, sprint planning, or project portfolio management.

---

## 6. What success looks like

DKF v1.0 should not be defined by feature count.

The target v1.0 threshold is that DKF can publicly demonstrate that its reliability controls materially reduce false AI completion and missed engineering obligations compared with unguided agentic development.

The benchmark should measure outcomes such as:

- false completion accepted;
- missing requirement detection;
- stale evidence detection;
- security/control coverage gaps;
- unauthorized architecture drift;
- scope violations;
- regression escape rate;
- required human interventions;
- tokens consumed;
- time to **verified** completion.

The standard is not "the agent produced code quickly."

The standard is:

> **The change is demonstrably acceptable, and DKF can show why.**
