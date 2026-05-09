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
**Status**: COMPLETED (Thresholds crossed due to cross-region Redis)

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| HTTP Request p(95) | < 500ms | 1920ms | FAIL |
| Error Rate | < 1.00% | 0.00% | PASS |
| Answer Save p(95) | < 300ms | 1368ms | FAIL |
| Submit Exam p(95) | < 1000ms | 2814.3ms | FAIL |

### Observations & Fixes (500 VUs)
- **Bottleneck Discovered**: Highly elevated latency at scale. Under 500 VUs, the system remained perfectly functional with **0% error rate** (all 65,350 requests succeeded), but the p(95) latency targets were missed.
- **Root Cause**: High network latency between the application servers (Render) and the Redis instance (Upstash). Since they were deployed in different geographical regions, every Redis network call added a latency penalty. This penalty compounded because endpoints like answer-saving, heartbeat recording, and rate-limiting perform multiple sequential Redis operations.
- **Mitigation/Resolution**: Migrate and align the Upstash Redis database region to match the hosting region of the Render backend web services.

---

## 2. Peak Target Test (2000 VUs)
**Goal**: Confirm the system handles the stated peak load of 2000 concurrent students in the SPEC.
**Status**: DEFERRED

### Observations & Fixes (2000 VUs)
Deferred until the Upstash Redis region alignment is complete and verified to ensure that the latency baseline matches the local sub-millisecond expected Redis times.
