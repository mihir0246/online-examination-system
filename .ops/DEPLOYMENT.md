# Deployment & Environment Strategy

This document outlines the standard operating procedure for deploying the Online Examination System to AWS Elastic Beanstalk, preventing downtime, and maintaining database integrity.

## 1. Environment Strategy
- **Staging (`exam-staging`)**: Mirrors production architecture. Uses `DATABASE_URL` pointing to the Atlas Staging Cluster. Always deploy here first.
- **Production (`exam-prod`)**: The live environment. Uses `DATABASE_URL` pointing to the Atlas Production Cluster (M10+ required for PITR).

> [!CAUTION]
> Never mix environment variables. Deploying with a staging `DATABASE_URL` to the production Beanstalk environment will cause severe data corruption and cross-contamination.

## 2. No-Deploy Window Policy
**Production deployments are strictly prohibited during active exam windows.**
- **Lockout Period**: No deployments allowed within 2 hours before an exam starts, during the exam, or 1 hour after the exam ends.
- **Verification**: Run this query in Atlas/Prisma Studio before initiating a deployment:
  ```javascript
  db.Test.find({ testbegins: true, isRegistrationavailable: false })
  ```
  If any tests are actively running, abort the deployment.

## 3. Zero-Downtime Rolling Deploys
To prevent taking the system offline during routine deployments, Elastic Beanstalk is configured to perform Rolling Updates (`.ebextensions/rolling-deploy.config`).
- Instances are updated in batches (50%).
- Health checks must pass before the next batch is updated.
- No active connections are dropped abruptly during the shift.

## 4. Promotion Checklist
Before flipping traffic or deploying the production bundle:
- [ ] Ensure we are outside the "No-Deploy Window".
- [ ] Verify `npx prisma db push` (or `prisma migrate deploy`) has been successfully run against the Staging Atlas cluster.
- [ ] Staging QA sign-off completed.
- [ ] **Run Prisma Migration on Production**: Run `npx prisma db push` manually via CLI against the Production DB URL *before* deploying the new app bundle.

## 5. Rollback Procedure
If a deployment fails or critical bugs are discovered post-deploy:

1. **Application Rollback**:
   - Go to AWS Elastic Beanstalk console.
   - Navigate to **Application Versions**.
   - Select the previously stable version and click **Deploy**.

> [!WARNING]
> **EB Rollback DOES NOT rollback the Prisma Schema!**
> If your deployment included a database schema change (`db push`), the Elastic Beanstalk rollback only reverts the Node.js code. 
> You must manually revert the schema in MongoDB Atlas or carefully run a backward-compatible Prisma push, otherwise the old application code will crash when querying the new schema structure. This is the most dangerous rollback scenario.
