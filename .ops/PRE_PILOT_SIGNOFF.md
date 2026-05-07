# Pre-Pilot Operational Sign-Off Checklist

This checklist must be completely filled out and committed to the repository before the Phase 10 Pilot Exam is scheduled or executed. Do not proceed with live students until all boxes are ticked and signed off by the System Owner.

## 1. Infrastructure & Monitoring
- [ ] AWS Elastic Beanstalk `alarms.config` is deployed and alarms are visible in the CloudWatch dashboard.
- [ ] SNS Topic ARN is wired into the CloudWatch alarms.
- [ ] Sentry alert routing is configured to escalate to Push Notification/SMS during the scheduled exam window.
- [ ] **Uptime Monitoring**: External monitor (e.g., Better Uptime, UptimeRobot) is configured to hit the root/login page every minute and alert on failure.
- [ ] **Audit Spikes**: MongoDB Atlas Triggers/Lambda are configured to push `OWNERSHIP_VIOLATION` and `AUTH_FAILURE` counts to CloudWatch.

## 2. Data Governance & Security
- [ ] Production Database is on MongoDB Atlas M10 tier or higher (required for PITR).
- [ ] Monthly backup restoration test has been performed, and the `ExamEvent` TTL index successfully survived the restore.
- [ ] Production `DATABASE_URL` and `JWT_SECRET` are securely injected via AWS Parameter Store / EB Environment Variables.
- [ ] Redis caching layer is actively running and connected in Production.

## 3. Application State & Testing
- [ ] Load test passed successfully on the M10 Atlas cluster (Target: p95 < 500ms at 500 VUs).
- [ ] Frontend changes (injection of `withCredentials: true` and `Authorization: Bearer` headers) have been successfully merged and deployed to Production.
- [ ] The `npx prisma db push` command was successfully run against the Production Atlas cluster.

## 4. Personnel & Runbooks
- [ ] On-call contacts (System Owner, IT Contact, Academic Coordinator) are confirmed and have read `INCIDENT_RESPONSE.md`.
- [ ] The No-Deploy Window is officially locked in on the calendar.
- [ ] The Academic Coordinator has been provided with the `AUDIT_GUIDE.md` and understands how to query the audit logs for grade disputes.

---
**System Owner Sign-Off:** ___________________________  **Date:** _________________
