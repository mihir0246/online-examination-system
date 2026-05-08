# Remaining Tasks for Online Examination System

This document consolidates all the pending tasks and checklists required to successfully launch the pilot and achieve full production-readiness, based on the current project state.

## 🚀 1. Phase 10: Pilot and Go-Live (Active Phase)
*Sourced from `.gsd/ROADMAP.md`*

- [ ] **Pre-Flight Load Test:** Run production k6 test on Atlas M10+ (target: p95 < 500ms at 2000 VUs).
- [ ] **Pilot Exam:** Execute one class session (20–50 students) under full monitoring.
- [ ] **Official Sign-Off:** System owner signs the go/no-go checklist.

---

## 🛠️ 2. Post-Deployment Checklist
*Sourced from `deployment_guide.md`*

- [ ] Verify that the Render backend service shows **Live** (green) in the Render dashboard.
- [ ] Verify `GET /health` returns `{"status":"UP"}` on the Render backend URL.
- [ ] Verify that the Frontend URL provided by Amplify is reachable.
- [ ] Log in with the Admin account (`admin@gmail.com`) to confirm database connectivity.
- [ ] Upload an image in a question and verify it successfully stores and loads from the configured AWS S3 bucket.
- [ ] Confirm Redis is connected (Render logs show `🚀 Redis connected successfully`).

---

## 📋 3. Pre-Pilot Exam Checklist (T-24 Hours to T-0)
*Sourced from `docs/PRE_PILOT_CHECKLIST.md`*

### Infrastructure & Monitoring
- [ ] Verify `GET /health` returns `{"status":"UP"}`.
- [ ] Verify MongoDB Atlas connection is active and auto-backup is enabled.
- [ ] Verify Redis is connected and responding (`redis-cli ping`).
- [ ] Ensure `SENTRY_DSN` (Backend) and `NEXT_PUBLIC_SENTRY_DSN` (Frontend) are set, and verify test events appear in Sentry.
- [ ] Confirm Server clock is synchronized (`GET /api/v1/time` returns current UTC time).

### Security Verification
- [ ] Confirm all admin/trainer routes return `403` for non-admin users.
- [ ] Confirm exam questions return `403` before `testbegins = true`.
- [ ] Verify JWT blacklist is working (logout and attempt to use old token expects `401`).
- [ ] Ensure CORS origin is strictly locked to the production frontend URL.
- [ ] Verify file upload security (only accepts PDFs/DOCX/Images, rejects executables).

### Pilot Exam Configuration
- [ ] Create Pilot exam in the system with correct title, duration, and question count.
- [ ] Confirm `isRegistrationAvailable = true`, `testbegins = false`, and `testconducted = false` before start time.
- [ ] Register the pilot student list and send test links via email.
- [ ] Verify all questions: correct options marked, difficulty set, no duplicates.

### Team & Communication Plan
- [ ] Brief invigilators on starting the exam, monitoring trainees, and extending time.
- [ ] Ensure on-call engineer is available for the full exam duration.
- [ ] Set up instant communication channels (e.g., Slack/WhatsApp group) for the exam session.

---

## 📊 4. Post-Pilot Evaluation
*To be completed within 24 hours of the pilot exam.*

- [ ] Ensure zero submissions lost (verify `AnswerSheet.completed` count matches registered count).
- [ ] Verify all results generated correctly.
- [ ] Review Sentry for zero P0 alerts during the exam window.
- [ ] Verify p95 latency during the exam via server logs/monitoring dashboard.
- [ ] Send trainee feedback survey.
- [ ] Conduct post-mortem and add lessons learned to `RUNBOOK.md`.
- [ ] **Final Sign-off:** System ready for full institutional rollout.
