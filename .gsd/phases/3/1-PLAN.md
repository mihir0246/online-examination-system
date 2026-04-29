---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Load Test Execution — Run k6, Fix Bottlenecks

## Objective
The k6 load test script exists at `load-tests/k6-exam-session.js` but has never been executed
against the actual backend. The SPEC claims "p95 < 500ms" but there is no evidence. Run the test,
capture the result, identify what breaks, fix it, run again until thresholds pass.

## Context
- `load-tests/k6-exam-session.js` — existing k6 script (500 VUs, full exam session lifecycle)
- `load-tests/README.md` — instructions
- `backend/app.js` — connection pool config (maxPoolSize: 100)
- Backend must be running locally at `http://localhost:5000`
- k6 must be installed: `winget install k6` or `choco install k6`

## Tasks

<task type="auto">
  <name>Install k6 and run the load test</name>
  <files>load-tests/k6-exam-session.js, load-tests/README.md</files>
  <action>
    1. Check if k6 is installed: `k6 version`
       If not: install via `winget install k6` or download from https://dl.k6.io/msi/k6-latest-amd64.msi
    
    2. Ensure the backend is running: `npm start` in `backend/`
    
    3. Run the load test with output to file:
       ```
       k6 run --out json=load-tests/results.json load-tests/k6-exam-session.js 2>&1 | Tee-Object load-tests/results.txt
       ```
    
    4. After run, check summary in `load-tests/results.txt` for:
       - `http_req_duration` p95 value — target: < 500ms
       - `http_req_failed` rate — target: < 1%
       - Any ECONNREFUSED or timeout errors — these indicate pool exhaustion
    
    5. Common fixes if thresholds fail:
       - If p95 > 500ms on `/api/v1/trainee/answersheet/update`: Add DB index on `traineeId` in AnswerSheet
       - If connection errors appear: Increase `maxPoolSize` in app.js from 100 → 200
       - If CPU spikes: Check for N+1 queries in the hot path (trainee endpoint loops)
    
    6. After fixing, re-run k6 until thresholds pass.
  </action>
  <verify>Select-String "p95" load-tests/results.txt | Select-Object -First 5</verify>
  <done>results.txt exists. p95 http_req_duration < 500ms. http_req_failed rate < 1%.</done>
</task>

<task type="auto">
  <name>Document results and commit evidence</name>
  <files>load-tests/RESULTS.md</files>
  <action>
    Create `load-tests/RESULTS.md` with:
    - Date of test run
    - Backend environment (local/staging)
    - VU count and duration
    - Key metrics: p50, p95, p99 for http_req_duration
    - Error rate
    - Pass/Fail against thresholds
    - Any fixes applied
    
    Then commit:
    ```
    git add load-tests/RESULTS.md load-tests/results.txt
    git commit -m "test: k6 load test results — p95 confirmed < 500ms"
    ```
  </action>
  <verify>Test-Path load-tests/RESULTS.md</verify>
  <done>RESULTS.md exists with actual p95 values documented. Committed to git.</done>
</task>

## Success Criteria
- [ ] k6 runs successfully against local backend
- [ ] p95 `http_req_duration` < 500ms
- [ ] `http_req_failed` rate < 1%
- [ ] `load-tests/RESULTS.md` created with evidence
- [ ] Any fixes from the run are committed separately with clear commit messages
