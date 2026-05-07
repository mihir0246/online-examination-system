/**
 * Plan 4.3: k6 Load Test — Full Exam Session Lifecycle
 *
 * Tests the complete trainee journey: registration → start → answer → submit
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run: k6 run k6-exam-session.js --out json=results.json
 * HTML report: k6 run k6-exam-session.js --out web-dashboard
 *
 * Thresholds (from SPEC):
 *   - p95 response time < 500ms
 *   - Error rate < 1%
 *   - All critical endpoints must pass
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────
const errorRate      = new Rate('exam_errors');
const answerSaveDuration = new Trend('answer_save_duration');
const submitDuration = new Trend('submit_duration');

// ── Load profile (matches SPEC: 500 & 2000 concurrent, p95 < 500ms) ───────────────
const targetVUs = parseInt(__ENV.VUS || '500', 10);

export const options = {
  stages: [
    { duration: '30s', target: Math.floor(targetVUs * 0.2) },  // Warm up
    { duration: '60s', target: targetVUs  },  // Ramp to Target VUs
    { duration: '120s', target: targetVUs },  // Sustain peak load
    { duration: '30s', target: 0    },  // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],          // SPEC requirement: p95 < 500ms
    'http_req_failed': ['rate<0.01'],            // Error rate < 1%
    'exam_errors': ['rate<0.01'],
    'answer_save_duration': ['p(95)<300'],       // Answers should be faster
    'submit_duration': ['p(95)<1000'],           // Submit can take up to 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_ID  = __ENV.TEST_ID  || 'replace-with-real-test-id';

const headers = { 'Content-Type': 'application/json' };

// ── Virtual User scenario ──────────────────────────────────────────────────
export default function () {
  const vuId = `loadtest_vu_${__VU}_${__ITER}`;

  // 1. Register as a trainee
  const registerRes = http.post(
    `${BASE_URL}/api/v1/trainee/enter`,
    JSON.stringify({
      name: `Test User ${vuId}`,
      emailid: `${vuId}@loadtest.example.com`,
      contact: `9${String(__VU).padStart(4, '0')}${String(__ITER).padStart(5, '0')}`,
      organisation: 'Load Test Corp',
      location: 'Test City',
      testid: TEST_ID,
    }),
    { headers }
  );

  const regOk = check(registerRes, {
    'register: status 200 or 409': (r) => r.status === 200 || r.status === 409,
    'register: has user id': (r) => {
      const body = JSON.parse(r.body);
      return body.success || body.message?.includes('Already registered');
    },
  });

  if (!regOk) { errorRate.add(1); return; }
  errorRate.add(0);

  let traineeId;
  try {
    const body = JSON.parse(registerRes.body);
    traineeId = body.user?.id;
    if (!traineeId) { errorRate.add(1); return; }
  } catch { errorRate.add(1); return; }

  sleep(1);

  // 2. Start answer sheet
  const sheetRes = http.post(
    `${BASE_URL}/api/v1/trainee/answersheet`,
    JSON.stringify({ testid: TEST_ID, userid: traineeId }),
    { headers }
  );
  check(sheetRes, { 'answersheet: 200': (r) => r.status === 200 });
  errorRate.add(sheetRes.status !== 200 ? 1 : 0);

  sleep(0.5);

  // 3. Fetch questions (content-gated — only works if testbegins=true)
  const qRes = http.post(
    `${BASE_URL}/api/v1/trainee/paper/questions`,
    JSON.stringify({ id: TEST_ID, userid: traineeId }),
    { headers }
  );
  check(qRes, { 'questions: 200': (r) => r.status === 200 });

  let questions = [];
  try { questions = JSON.parse(qRes.body).data || []; } catch {}

  // 4. Save answers (simulate answering 5 questions)
  const answerBatch = questions.slice(0, 5);
  for (const q of answerBatch) {
    const start = Date.now();
    const ansRes = http.post(
      `${BASE_URL}/api/v1/trainee/update/answer`,
      JSON.stringify({
        testid: TEST_ID,
        userid: traineeId,
        qid: q.id,
        newAnswer: q.options?.[0]?.optbody || 'Load test answer',
        isBookmarked: false,
      }),
      { headers }
    );
    answerSaveDuration.add(Date.now() - start);
    check(ansRes, { 'answer save: 200': (r) => r.status === 200 });
    errorRate.add(ansRes.status !== 200 ? 1 : 0);
    sleep(0.2);
  }

  // 5. Send heartbeat
  http.post(
    `${BASE_URL}/api/v1/trainee/heartbeat`,
    JSON.stringify({ testid: TEST_ID, userid: traineeId }),
    { headers }
  );

  sleep(1);

  // 6. Submit exam
  const start = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/api/v1/trainee/end/test`,
    JSON.stringify({ testid: TEST_ID, userid: traineeId }),
    { headers }
  );
  submitDuration.add(Date.now() - start);
  check(submitRes, { 'submit: 200': (r) => r.status === 200 });
  errorRate.add(submitRes.status !== 200 ? 1 : 0);

  sleep(2);
}
