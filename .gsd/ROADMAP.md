---
milestone: Production Hardening
version: 1.1.0
updated: 2026-04-30
---

# Roadmap

> **Current Phase:** Phase 2 — Result Privacy Server-Gate
> **Status:** 🔄 In Progress

## Must-Haves (from Review Findings)

- [ ] Single ORM — Mongoose fully removed; Prisma is the only DB layer. *(No double connection pool)*
- [ ] Result privacy enforced at the API layer — students cannot read scores before `isResultgenerated`. *(Server-side gate, not UI-only)*
- [ ] k6 load test executed against real backend — p95 < 500ms confirmed with evidence.
- [ ] PDF bulk question parser stable — handles MCQ, descriptive, and table-layout PDFs without crashing.

---

## Phases

### Phase 1: ORM Consolidation
**Status:** ✅ Complete
**Objective:** Remove Mongoose entirely. Prisma becomes the single source of truth for all DB operations. Eliminate the dual connection pool and stale `schemas/` directory.
**Depends on:** Nothing

**Plans:**
- [x] Plan 1.1: Remove `mongoose.connect()` from `app.js`, uninstall mongoose package, delete unused `schemas/` files.

---

### Phase 2: Result Privacy Server-Gate
**Status:** ✅ Complete
**Objective:** Ensure student-facing result endpoints check `test.isResultgenerated` on the server before returning any score. A UI-only toggle is bypassable with DevTools.
**Depends on:** Phase 1 ✅

**Plans:**
- [x] Plan 2.1: Audit all trainee-accessible result/score endpoints and add server-side `isResultgenerated` guard.
- [x] Plan 2.2: Add a `isResultPublished` boolean field to the Test model (distinct from `isResultgenerated`) so faculty can explicitly release results independently.

---

### Phase 3: Load Test Execution
**Status:** 🔄 In Progress
**Objective:** Actually run the k6 load test against the real backend. Document the result. Fix whatever breaks (connection pool exhaustion, CPU spike, slow endpoints).
**Depends on:** Phase 2 ✅

**Plans:**
- [ ] Plan 3.1: Run k6 locally against `http://localhost:5000`, capture output, fix top bottlenecks.

---

### Phase 4: PDF Parser Hardening
**Status:** ⬜ Not Started
**Objective:** Fix the bulk question parser so it handles mixed MCQ/descriptive questions and table-based PDF layouts without crashing. Add Zod schema that accepts both types.
**Depends on:** Phase 1 ✅

**Plans:**
- [ ] Plan 4.1: Refactor `questionParser.js` — table-aware extraction, stable Zod schema for mixed types, crash-safe error boundaries.

---

## Progress Summary

| Phase | Status | Plans | Complete |
|-------|--------|-------|----------|
| 1 | 🔄 | 1/1 | — |
| 2 | ⬜ | 2/2 | — |
| 3 | ⬜ | 1/1 | — |
| 4 | ⬜ | 1/1 | — |
