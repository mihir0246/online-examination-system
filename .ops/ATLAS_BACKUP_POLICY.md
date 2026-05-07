# MongoDB Atlas Backup & Recovery Policy

This document defines the data governance, recovery targets, and testing procedures for the Online Examination System's database.

## 1. Recovery Targets (RTO & RPO)
- **RTO (Recovery Time Objective)**: `< 4 hours`. The maximum acceptable downtime required to restore the database and resume application services in the event of a total cluster failure or data corruption.
- **RPO (Recovery Point Objective)**: `< 1 hour`. The maximum acceptable data loss. 

> [!IMPORTANT]
> **Atlas Tier Requirement**: Point-In-Time Recovery (PITR), which is strictly required to achieve an RPO of < 1 hour, is **only available on Atlas M10 clusters and above**. If the production environment is currently running on an M0, M2, or M5 shared tier, these recovery targets are mathematically impossible to guarantee. 

## 2. Excluded Ephemeral Data
The MongoDB Atlas backup captures all persistent operational data (Users, Tests, Results, AnswerSheets, AuditLogs).
**However, the following system state is stored in Redis and is NOT backed up:**
- Active JWT Blacklists
- Exam Session Idempotency Locks
- In-flight Trainee Exam State (e.g., current question index, remaining time)
- Rate Limiter IP states

**Post-Restore Runbook**:
If a full database restoration occurs mid-exam, trainees will be forcibly logged out. They must re-authenticate to generate new JWTs. The frontend will pull the last persisted `AnswerSheet` state from MongoDB upon reentry.

## 3. Monthly Verification Procedure
A backup is only valid if it can be successfully restored. This procedure must be executed on the 1st of every month.

1. Log into the MongoDB Atlas Console.
2. Navigate to **Clusters** -> **Backup** -> **Restore**.
3. Select a snapshot from the previous 24 hours.
4. Choose **Restore to a different cluster** (target the Staging cluster `exam-staging`).
5. Wait for completion and connect Prisma Studio to the staging cluster.
6. **Critical Check: TTL Index Verification**:
   - Atlas restores the data, but you must confirm the `expiresAt` TTL index on the `ExamEvent` collection survived the restoration. If the index is missing, the collection will grow unboundedly. Run `db.ExamEvent.getIndexes()` to verify.
7. Document the successful test with the date, RTO achieved during the test, and signature of the verifying engineer.
