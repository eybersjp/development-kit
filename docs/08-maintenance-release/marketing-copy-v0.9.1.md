# Marketing Copy — Development Kit v0.9.1 (Prepared Draft)

**Status**: PREPARED / DO NOT PUBLISH YET  
**Release**: v0.9.1 (Field Hardening)  

---

## 1. GitHub Release Description

```markdown
### Development Kit v0.9.1 — Field Hardening & Interaction Integrity

Development Kit v0.9.1 delivers essential reliability and interaction integrity hardening for the Reliability Control Plane.

#### What's in this release:
- **Strict Cryptographic Interaction Binding**: Product Owner discovery interactions are bound to SHA-256 fingerprints, eliminating single-turn self-confirmation vulnerabilities.
- **Two-Phase Commit (2PC) Journaling**: Append-only journaling (`discovery-journal.json`) protects discovery candidate and decision state against abrupt process interrupts.
- **Append-Only Hash-Chained Receipts**: Consumed interactions are recorded with cryptographic hash chains, preventing stale interaction replay.
- **Truthful Design Authority**: Verifies design setup directly against persisted state, preventing mock bypasses.
- **Strict Scope Proposal Binding**: Requires full explicit proposal persistence and human confirmation for scope classification.
- **Project-Root Affinity**: Hardened root-resolution handles spaces, symlinks, and nested invocations flawlessly.

Install or upgrade:
```bash
npx development-kit init --global
```
```

---

## 2. npm Package Description / README Summary

```text
Development Kit installs a disciplined AI software-development team into your coding agent. Featuring the Reliability Control Plane, Contract-Driven Orchestration, DKF Design Authority, and fail-closed verification.
```

---

## 3. GitHub Repository Description (About section)

```text
Engineering discipline, contract-driven orchestration, and fail-closed verification for AI coding agents.
```

---

## 4. LinkedIn Announcement Copy

```text
Autonomous AI coding agents can write code at incredible speed, but without rigorous execution discipline, speed creates rework: unverified claims, skipped reviews, and hallucinated completion.

With Development Kit v0.9.1, we're releasing a major field-hardening patch for our Reliability Control Plane:
🔒 Cryptographic interaction fingerprinting that prevents single-turn self-confirmation.
🛡️ Two-phase commit (2PC) journaling that eliminates state corruption on abrupt interrupts.
⛓️ Hash-chained consumption receipts preventing interaction replay attacks.
🎨 Verified Design Authority state ensuring frontend visual consistency.

Learn more and get started: https://github.com/eybersjp/development-kit
```

---

## 5. X / Twitter Announcement Copy

```text
AI coding agents shouldn't be allowed to grade their own homework.

Development Kit v0.9.1 is out with field-hardened interaction integrity:
• Cryptographic interaction fingerprints
• 2PC append-only state journaling
• Hash-chained consumption receipts
• Fail-closed human-in-the-loop gates

https://github.com/eybersjp/development-kit
```
