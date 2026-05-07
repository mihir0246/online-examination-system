# Production Load Test Results (AWS Validation)

This document tracks the final pre-pilot empirical validation of the Online Examination System against the live AWS Elastic Beanstalk and MongoDB Atlas M10 infrastructure.

## Environment Checklist (PRE-FLIGHT)
Before firing the load test, the following parameters **must** be confirmed on the live environment to avoid false failures:
- [ ] **AWS Elastic Beanstalk (EB)** minimum autoscaling instances is set to `2`.
- [ ] **MongoDB Atlas (M10)** connection limit is `1500` (sufficient for 2000 VUs).
- [ ] **Mongoose `maxPoolSize`** is configured to `100` in the backend code/env.
- [ ] **Redis** `maxmemory-policy` is set to `allkeys-lru`.
- [ ] The AWS environment has been spun up and given 10 minutes to warm up (no cold-starts).
- [ ] College IT has confirmed a strict "no real exams" window during the test duration.

## Load Test Parameters
- **Target Metrics (SPEC)**: `p(95) < 500ms`, `error rate < 1%`.
- **Script**: `load-tests/k6-exam-session.js`

To run the tests:
```bash
# Run Baseline (500 VUs)
k6 run -e VUS=500 -e BASE_URL=https://<your-aws-url> -e TEST_ID=<active-test-id> k6-exam-session.js

# Run Peak Target (2000 VUs)
k6 run -e VUS=2000 -e BASE_URL=https://<your-aws-url> -e TEST_ID=<active-test-id> k6-exam-session.js
```

---

## 1. Baseline Test (500 VUs)
**Goal**: Establish a baseline on the warm infrastructure.
**Status**: [PENDING]

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| HTTP Request p(95) | < 500ms | _ms | _ |
| Error Rate | < 1.00% | _% | _ |
| Answer Save p(95) | < 300ms | _ms | _ |
| Submit Exam p(95) | < 1000ms | _ms | _ |

### Observations & Fixes (500 VUs)
_Document any bottlenecks discovered here (e.g., MongoDB pool exhaustion, EB CPU spikes) and what was fixed before re-running._

---

## 2. Peak Target Test (2000 VUs)
**Goal**: Confirm the system handles the stated peak load of 2000 concurrent students in the SPEC.
**Status**: [PENDING]

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| HTTP Request p(95) | < 500ms | _ms | _ |
| Error Rate | < 1.00% | _% | _ |
| Answer Save p(95) | < 300ms | _ms | _ |
| Submit Exam p(95) | < 1000ms | _ms | _ |

### Observations & Fixes (2000 VUs)
_Document any bottlenecks discovered here and the corresponding fixes._
