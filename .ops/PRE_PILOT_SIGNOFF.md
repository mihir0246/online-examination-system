# Pre-Pilot Operational Sign-Off Checklist

This checklist must be completely filled out and committed to the repository before the Phase 10 Pilot Exam is scheduled or executed. Do not proceed with live students until all boxes are ticked and signed off by the System Owner.

## 1. Infrastructure & Monitoring
- [ ] Render Web Service is in **Live** state (green) in the Render dashboard.
- [ ] Sentry alert routing is configured to escalate to Push Notification/SMS during the scheduled exam window.
- [ ] **Uptime Monitoring**: External monitor (e.g., Better Uptime, UptimeRobot) is configured to hit `GET /health` every minute and alert on failure.
- [ ] **Audit Spikes**: MongoDB Atlas Triggers alert when `OWNERSHIP_VIOLATION` or `AUTH_FAILURE` events exceed **10 events/minute** (or 5× the 7-day rolling baseline, whichever is lower), with alerts routed to Sentry and on-call SMS. Response procedure: acknowledge within 5 minutes, check `GET /api/v1/audit?event=AUTH_FAILURE&limit=50` for pattern, escalate to System Owner if more than 3 affected users.

## 2. Data Governance & Security
- [ ] Production Database is on MongoDB Atlas M10 tier or higher (required for PITR).
- [ ] Monthly backup restoration test has been performed, and the `ExamEvent` TTL index successfully survived the restore.
- [ ] Production `DATABASE_URL` and `JWT_SECRET` are securely set in **Render Environment Variables** (not in `.env` committed to git).
- [ ] Redis (Upstash/Redis Cloud) is actively running and connected — Render logs show `🚀 Redis connected successfully`.
- [ ] **Redis persistence** is enabled (AOF or RDB snapshots configured in Upstash/Redis Cloud settings) to prevent exam state and JWT blacklist data loss on restart.

## 3. Application State & Testing
- [ ] Load test passed on live Render + Atlas M10 (Target: p95 < 500ms at 500 VUs **sustained for the full expected exam duration**, e.g. 2 hours). Results documented in `load-tests/RESULTS.md`.
- [ ] Frontend `NEXT_PUBLIC_API_URL` in Amplify env vars points to the live Render HTTPS URL (not localhost).
- [ ] The `npx prisma db push` command was successfully run against the Production Atlas cluster.
- [ ] CORS: `FRONTEND_URL` env var on Render is locked to the exact Amplify production URL.
- [ ] **Rate limiting** verified live: login endpoint rejects on the 6th attempt within 60 seconds (`429`); answer-update endpoint rejects beyond 60 requests/minute per student.
- [ ] **Disaster recovery / rollback plan** confirmed: `RUNBOOK.md` Runbook 5 (Exam-in-Progress Emergency) has been reviewed by the on-call engineer and a rollback to the previous Render deploy can be executed within 5 minutes via Render dashboard → Deploys → Rollback.

## 4. Personnel & Runbooks
- [ ] On-call contacts (System Owner, IT Contact, Academic Coordinator) are confirmed and have read `INCIDENT_RESPONSE.md`.
- [ ] The No-Deploy Window is officially locked in on the calendar.
- [ ] The Academic Coordinator has been provided with the `AUDIT_GUIDE.md` and understands how to query the audit logs for grade disputes.

---
**System Owner Sign-Off:** ___________________________  **Date:** _________________
