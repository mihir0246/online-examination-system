# Detailed Project Plans (Phases 1–11)

*This document preserves the granular, task-by-task execution checklists for all historical development phases of the Online Examination System.*

---

### Phase 1: Foundation & Performance Baseline
**Status:** ✅ Complete
**Objective:** Establish a stable, high-performance base with modernized code and resource management.

**Plans:**
- [x] Plan 1.1: Backend ES6+ Refactor and Global Error Handler.
- [x] Plan 1.2: Redis integration (Pre-warming, and Blacklist via `services/redis.js`).
- [x] Plan 1.3: MongoDB Connection Pooling (maxPoolSize: 100, tuned for 2k concurrency).
- [x] Plan 1.4: Server-side Clock Sync (X-Server-Time header + `/api/v1/time` endpoint).

---

### Phase 2: Data Integrity & Security Core
**Status:** ✅ Complete
**Objective:** Implement critical safeguards for student data and secure authentication.

**Plans:**
- [x] Plan 2.1: Transactional answer submission and Idempotency logic.
- [x] Plan 2.2: Implement background Auto-Save with LocalStorage buffering.
- [x] Plan 2.3: Exam State Persistence (sync currentQuestion/remainingTime to Redis).
- [x] Plan 2.4: HttpOnly Cookies (login) + Redis-based JWT Revocation (logout blacklist).
- [x] Plan 2.5: Frontend stabilization (hydration/warning fixes).

---

### Phase 3: Institutional Controls & Exam Integrity
**Status:** ✅ Complete
**Objective:** Build tools for institutional oversight and proctoring.

**Plans:**
- [x] Plan 3.1: Immutable Audit Logging system.
- [x] Plan 3.2: Server-side Question Randomization and Content Gating.
- [x] Plan 3.3: Heartbeat API and real-time connectivity monitoring.
- [x] Plan 3.4: Circuit Breaker implementation and Mobile responsiveness.
- [x] Plan 3.5: Faculty Publish Workflow and Result Access Controls.

---

### Phase 4: Operational Readiness & Pilot
**Status:** ✅ Complete
**Objective:** Final hardening, monitoring, and real-world validation.

**Plans:**
- [x] Plan 4.1: Sentry integration (Frontend/Backend) and Alerting rules.
- [x] Plan 4.2: Backup verification and Disaster Recovery runbook.
- [x] Plan 4.3: Final E2E load test (1000+ users).
- [x] Plan 4.4: Pilot Exam with a controlled class group.

---

### Phase 5: Security Hardening Round 2
**Status:** ✅ Complete
**Objective:** Close the identity spoofing attack surface on trainee routes, add rate limiting, fix CSRF scoping, and prevent result duplication.

**Plans:**
- [x] Plan 5.1: Issue signed trainee tokens at registration. Apply token verification to answer/submit routes.
- [x] Plan 5.2: Apply express-rate-limit to `/login` (20 req/15min) and `/trainee/enter` (5 req/min per IP).
- [x] Plan 5.3: Fix CSRF getSessionIdentifier — use `req.user?.id || req.ip` instead of hardcoded string.
- [x] Plan 5.4: Fix result duplication in gresult — upsert instead of create.

---

### Phase 6: Audit Coverage Completion
**Status:** ✅ Complete
**Objective:** Wire the `auditLog` utility into the remaining exam lifecycle events and handle tab-switch metrics.

**Plans:**
- [x] Plan 6.1: Wire auditFromReq into testpaper.js (publish, close) and results.js (generate, publish).
- [x] Plan 6.2: Persist logEvent (tab-switch, focus-loss) to ExamEvent collection with traineeId + timestamp + eventType.
- [x] Plan 6.3: Add admin query endpoint for audit trail per trainee/test.

---

### Phase 7: Operational Readiness
**Status:** ✅ Complete
**Objective:** Ensure the system can be monitored, recovered, and operated by someone other than the developer.

**Plans:**
- [x] Plan 7.1: Write DEPLOYMENT.md — environment strategy, promotion checklist, rollback procedure.
- [x] Plan 7.2: Write INCIDENT_RESPONSE.md — Sentry routing, on-call contacts, exam disruption protocol.
- [x] Plan 7.3: Document Atlas backup policy (RTO < 4h, RPO < 1h). Add monthly backup verification.
- [x] Plan 7.4: Configure CloudWatch/Beanstalk alarms: CPU>80%, memory>85%, DB connections>150, p95>500ms.

---

### Phase 8: Compliance and Data Governance
**Status:** ✅ Complete
**Objective:** Meet DPDP (India) requirements for PII storage and student data rights.

**Plans:**
- [x] Plan 8.1: Document DPDP compliance: PII inventory, retention periods (results: 5yr), deletion workflow.
- [x] Plan 8.2: Implement DELETE `/api/v1/admin/trainee/:id` with cascade and audit log.
- [x] Plan 8.3: Add RBAC permission matrix to ARCHITECTURE.md.

---

### Phase 9: UX and Mobile Baseline
**Status:** ✅ Complete
**Objective:** Verify the exam experience on mobile devices and confirm client-side auto-save behaviour.

**Plans:**
- [x] Plan 9.1: Verify exam flow on 375px viewport. Fixed critical layout issues with responsive drawer.
- [x] Plan 9.2: Confirm frontend calls `/update/answer` on a timer (not only on option-click). Done via useAutoSave.
- [x] Plan 9.3: Document grace period policy for disconnected students. Documented in GRACE_PERIOD_POLICY.md.

---

### Phase 10: Pilot and Go-Live
**Status:** ⬜ Not Started
**Objective:** Real-world validation with one class before full institutional rollout.

**Plans:**
- [ ] Plan 10.1: Run pilot exam — one class, 20–50 students, full monitored session.
- [ ] Plan 10.2: Run production k6 test on Atlas M10+ (target: p95 < 500ms at 500 VUs).
- [ ] Plan 10.3: Go/no-go sign-off checklist signed by system owner.

---

### Phase 11: Architecture Refactor & Scalability
**Status:** ✅ Complete
**Objective:** Eliminate structural technical debt; implement minimum-viable scalable architecture with caching, typed contracts, and operational observability.

**Plans:**
- [x] Plan 11.1: Centralize RBAC — `trainerSubjectGuard.js` middleware replaces 4 inline DB queries.
- [x] Plan 11.2: Apply `requireSelf` to all 7 ownership-sensitive trainee routes.
- [x] Plan 11.3: Fix `endTest` N+1 loop → parallel batch scoring (5 concurrent).
- [x] Plan 11.4: Fix sequential bulk email → parallel batches of 10 with `Promise.allSettled`.
- [x] Plan 11.5: Fix `checkFeedback` query bug — filter by `(traineeId, testId)`.
- [x] Plan 11.6: Add `deleteTest` live-exam safety guard (409 if exam is active).
- [x] Plan 11.7: Implement `services/cache.js` — 4h test fixture cache, 3s idempotency dedup.
- [x] Plan 11.8: Scalable foundations — `config/index.js`, `services/worker.js`, `routes/health.js`, typed Redux `AuthUser`.
