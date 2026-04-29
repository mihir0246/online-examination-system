# Disaster Recovery Runbook
**System:** Online Examination System  
**Version:** 1.0 | **Updated:** 2026-04-24  
**On-Call:** Backend Lead / DevOps

> ⚠️ **Never apply hotfixes directly to production. All changes must pass Staging first.**

---

## Severity Levels

| Severity | Definition | Response Time |
|----------|------------|---------------|
| **P0** | Exam in progress, data loss occurring | Immediate (< 5 min) |
| **P1** | Service down, exam blocked | 15 min |
| **P2** | Degraded performance, no data loss | 1 hour |
| **P3** | Non-critical issue | Next business day |

---

## Runbook 1: Application Rollback

**Trigger:** Sentry alert for elevated 5xx rate (> 5% over 5 minutes)

```bash
# 1. Identify last stable deployment
git log --oneline -10

# 2. Roll back to previous tag
git checkout <last-stable-tag>

# 3. Restart backend
pm2 restart sitrain  # or: eb deploy (Elastic Beanstalk)

# 4. Verify health check
curl https://api.yourdomain.com/health
# Expected: {"status":"UP","timestamp":"..."}

# 5. Check error rate drops in Sentry dashboard
```

---

## Runbook 2: MongoDB Atlas Backup Restore

**Trigger:** Data corruption detected OR accidental collection drop

```bash
# --- Atlas UI Restore ---
# 1. Login to https://cloud.mongodb.com
# 2. Navigate to: Project → Database → Backup
# 3. Select the snapshot BEFORE the incident timestamp
# 4. Click "Restore" → "Restore to New Cluster" (DO NOT restore to live cluster)
# 5. Validate data integrity on restored cluster:
#    db.AnswerSheet.count() — should match last known count
#    db.Result.count()
# 6. If validated, redirect connection string to restored cluster in .env
# 7. Restart application

# --- Point-in-Time Restore (Atlas M10+) ---
# Atlas → Backup → Point in Time → Select timestamp just before incident
```

**Post-restore checklist:**
- [ ] Verify all trainee submissions present (check AnswerSheet.completed count)
- [ ] Verify Result records match AnswerSheet records
- [ ] Run audit log query for last 24h to confirm integrity
- [ ] Notify affected users via email

---

## Runbook 3: Redis Failure & Recovery

**Trigger:** Circuit breaker OPEN (logs show `[CircuitBreaker:redis] OPEN`)

```bash
# 1. Check Redis connectivity
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
# Expected: PONG

# 2. If Redis is down, the circuit breaker will fail-open.
#    Auth blacklisting, heartbeat, and idempotency degrade gracefully.
#    No immediate action required unless Redis is down > 30 minutes.

# 3. Restart Redis (if self-hosted)
sudo systemctl restart redis

# 4. After Redis restores, circuit breaker auto-recovers in 30s (HALF_OPEN probe)

# 5. Pre-warm after recovery
curl -X POST https://api.yourdomain.com/api/v1/admin/prewarm \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Runbook 4: Full Service Recovery Sequence

**Use when:** Complete service outage (EC2 failure, deployment crash)

```bash
# Step 1: Check health
curl https://api.yourdomain.com/health

# Step 2: Check MongoDB
# Atlas dashboard → Metrics → Connection count

# Step 3: Check Redis
redis-cli ping

# Step 4: Review logs
pm2 logs sitrain --lines 200
# or: eb logs (Elastic Beanstalk)

# Step 5: Restart services in order
pm2 restart sitrain

# Step 6: Verify recovery
curl https://api.yourdomain.com/api/v1/time
# Expected: {"serverTime":"..."}

# Step 7: Run smoke test
k6 run load-tests/k6-exam-session.js --vus 5 --duration 30s \
  --env BASE_URL=https://api.yourdomain.com \
  --env TEST_ID=<smoke-test-id>
```

---

## Runbook 5: Exam-in-Progress Emergency

**Trigger:** Server crash during live exam (P0)

```bash
# Trainees automatically benefit from:
# - localStorage auto-save (answers preserved client-side)
# - Redis state sync (last question/time saved)

# 1. Restart backend ASAP (< 5 min)
pm2 restart sitrain

# 2. Notify trainees to refresh — they will resume from saved state
# (Answersheet endpoint restores savedState from Redis on re-entry)

# 3. If Redis also lost state — trainees can still submit via localStorage recovery
# (useAutoSave replays pending answers on reconnect)

# 4. Extend exam time if needed (admin panel → test management)
```

---

## Escalation Contacts

| Role | Contact | When |
|------|---------|------|
| On-Call Engineer | [Set by institution] | P0, P1 |
| MongoDB Atlas Support | 1-866-237-8317 | Atlas outage |
| AWS Support | aws.amazon.com/support | EC2/Beanstalk issues |
| Sentry Support | sentry.io/support | Monitoring issues |

---

## Daily Health Verification (Pre-Exam)

Run this check **15 minutes before any scheduled exam**:

```bash
# 1. Health endpoint
curl https://api.yourdomain.com/health

# 2. Time sync
curl https://api.yourdomain.com/api/v1/time

# 3. Redis ping (via pre-warm endpoint — requires ADMIN token)
curl -X POST https://api.yourdomain.com/api/v1/admin/prewarm \
  -H "Cookie: Token=$ADMIN_JWT"

# 4. Verify exam not prematurely gated (testbegins should be false until start)
# (Admin panel → Exam → Status)
```
