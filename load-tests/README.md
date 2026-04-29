# Load Tests — k6 Exam Session

## Prerequisites

```bash
# Install k6 (Windows)
winget install k6

# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo apt-get install k6
```

## Running the Load Test

### Quick smoke test (5 users, 30s)
```bash
k6 run k6-exam-session.js \
  --vus 5 \
  --duration 30s \
  --env BASE_URL=http://localhost:5000 \
  --env TEST_ID=<your-test-id>
```

### Full SPEC load test (500 VUs)
```bash
k6 run k6-exam-session.js \
  --env BASE_URL=https://api.yourdomain.com \
  --env TEST_ID=<your-test-id> \
  --out json=results/$(date +%Y%m%d_%H%M%S).json
```

### With HTML dashboard (real-time)
```bash
K6_WEB_DASHBOARD=true k6 run k6-exam-session.js \
  --env BASE_URL=http://localhost:5000 \
  --env TEST_ID=<your-test-id>
# Open browser: http://localhost:5665
```

## Thresholds (SPEC Requirements)

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `http_req_duration p(95)` | `< 500ms` | 95% of requests under 500ms |
| `http_req_failed` | `< 1%` | Error rate under 1% |
| `answer_save_duration p(95)` | `< 300ms` | Answer saves are fast |
| `submit_duration p(95)` | `< 1000ms` | Submit within 1s |

## Setup: Preparing a Test for Load Testing

1. Create a test in the admin panel with **at least 10 questions**
2. Set `testbegins = true` (required for content gating to pass)
3. Set `isRegistrationAvailable = true`
4. Copy the test ID and pass it via `--env TEST_ID=<id>`

> ⚠️ **Run load tests against a staging environment only.** Never against production.

## Interpreting Results

```
✓ register: status 200 or 409  → OK (409 = already registered, expected under repeat runs)
✓ answersheet: 200             → Session started successfully
✓ questions: 200               → Content gate passed (testbegins=true)
✓ answer save: 200             → Answer persisted with idempotency
✓ submit: 200                  → Exam submitted and results queued

checks.........................: 99.83% ✓ 49915 ✗ 85
data_received..................: 45 MB  188 kB/s
http_req_duration p(95)........: 423ms ← must be < 500ms ✅
http_req_failed................: 0.17% ← must be < 1% ✅
```
