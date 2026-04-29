# Pre-Pilot Exam Checklist
**System:** Online Examination System  
**Version:** 1.0 | **Updated:** 2026-04-24  
**Owner:** IT Lead / Dean of Academics Sign-off Required

> Complete **every** item before the pilot. Items marked 🔴 are blockers — do not proceed if any are unresolved.

---

## Section 1: Infrastructure Readiness (T-24 hours)

### Backend
- [ ] 🔴 Health check returns `{"status":"UP"}`: `GET /health`
- [ ] 🔴 MongoDB Atlas connection verified (Metrics > Connections > Active)
- [ ] 🔴 Redis connected and responding (`redis-cli ping → PONG`)
- [ ] 🔴 `SENTRY_DSN` set in production `.env` — verify Sentry dashboard shows test event
- [ ] `NODE_ENV=production` confirmed in server environment
- [ ] Server clock synchronized: `GET /api/v1/time` returns current UTC time
- [ ] Pre-warm endpoint called 15 minutes before exam start
- [ ] MongoDB Atlas auto-backup confirmed enabled (Atlas > Backup)

### Frontend
- [ ] 🔴 Frontend deployed and accessible at production URL
- [ ] 🔴 `NEXT_PUBLIC_SENTRY_DSN` set — verify test error appears in Sentry
- [ ] `NEXT_PUBLIC_API_URL` points to production backend (not localhost)
- [ ] No console errors on login, dashboard, or exam portal pages
- [ ] Tested on Chrome, Firefox, and Safari (latest versions)
- [ ] Tested on mobile viewport (min 375px width)

---

## Section 2: Security Review (T-24 hours)

- [ ] 🔴 All admin/trainer routes return 403 for non-admin users (spot check 3 routes)
- [ ] 🔴 Exam questions return 403 before `testbegins = true` (verify content gating)
- [ ] 🔴 JWT blacklist working: logout, then use old token — must receive 401
- [ ] 🔴 `isAnswer` field absent from question responses sent to trainees
- [ ] CORS origin locked to production frontend URL (not `*`)
- [ ] CSRF tokens required on all state-changing requests (verify `x-csrf-token` header)
- [ ] File upload: verify only PDFs/DOCX accepted (test with .exe — must be rejected)
- [ ] Rate limiting active on login endpoint (test 20+ rapid requests)

---

## Section 3: Exam Configuration (T-2 hours)

- [ ] 🔴 Pilot exam created in the system with correct: title, duration, question count
- [ ] 🔴 `isRegistrationAvailable = true` confirmed
- [ ] 🔴 `testbegins = false` confirmed (questions blocked until you flip it)
- [ ] 🔴 `testconducted = false` confirmed
- [ ] All questions verified: correct options marked, difficulty set, no duplicates
- [ ] Pilot student list registered and test links sent via email
- [ ] Backup registration link ready (in case email fails)
- [ ] Admin/trainer accounts for invigilators confirmed working
- [ ] Timer: confirm exam duration matches intended length

---

## Section 4: Load Test Sign-Off (T-48 hours)

- [ ] 🔴 k6 load test passed: `p95 < 500ms` under 500 VUs
  ```bash
  k6 run load-tests/k6-exam-session.js \
    --env BASE_URL=https://api.yourdomain.com \
    --env TEST_ID=<pilot-test-id>
  ```
- [ ] 🔴 Error rate `< 1%` during load test
- [ ] Screenshot of k6 results attached to this checklist
- [ ] Sentry showed zero P0 alerts during load test

---

## Section 5: Communication Plan (T-1 hour)

- [ ] Pilot students notified with: exam time, link, technical requirements
- [ ] Invigilator briefed on: how to start exam, how to monitor active trainees, how to extend time
- [ ] On-call engineer available for the full exam duration
- [ ] Rollback plan communicated to all stakeholders (ref: `RUNBOOK.md` Runbook 5)
- [ ] WhatsApp/Slack group created for instant communication during exam

---

## Section 6: Go/No-Go Decision (T-15 minutes)

| Check | Status | Owner |
|-------|--------|-------|
| All P0 items green | | IT Lead |
| Load test results approved | | Backend Lead |
| Security review signed | | Security Officer |
| Exam config verified | | Faculty |
| Communication sent | | Admin |

**Go/No-Go Decision:** ⬜ GO &nbsp;&nbsp; ⬜ NO-GO  
**Decided by:** _______________  
**At:** _______________

---

## Section 7: Exam Day — Start Procedure

```
T-15 min: Run health check sequence (RUNBOOK.md § Daily Health Verification)
T-10 min: Pre-warm Redis
T-5 min:  Confirm all invigilators at their stations
T-0:      Admin flips testbegins = true in Admin Panel
           → Students can now load questions
T+2 min:  Verify active-trainees endpoint shows expected count
           GET /api/v1/trainer/active-trainees/:testId
```

---

## Section 8: Post-Pilot Evaluation

Complete within 24 hours of exam:

- [ ] Zero submissions lost (verify AnswerSheet.completed count matches registered count)
- [ ] All results generated correctly (verify Result records)
- [ ] Sentry: zero P0 alerts during exam window
- [ ] p95 latency during exam (check server logs / monitoring dashboard)
- [ ] Trainee feedback survey sent
- [ ] Post-mortem document created (even if no incidents occurred)
- [ ] Lessons learned added to RUNBOOK.md
- [ ] Sign-off: system ready for full institutional rollout

---

## Rollback Criteria

**Abort the exam and rollback if ANY of the following occur:**
- Answer submission failing for > 5% of trainees for > 2 minutes
- Server error rate exceeds 10% sustained for 1 minute
- MongoDB connection pool exhausted (Atlas metrics)
- Sentry fires P0 alert with active data loss signature

**Rollback procedure:** See `RUNBOOK.md` → Runbook 5 (Exam-in-Progress Emergency)
