---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Result Privacy — Server-Side API Gate

## Objective
Ensure that student-facing endpoints NEVER return score data unless the faculty/admin has
explicitly published results (`test.isResultgenerated === true`). Currently the gate may only
exist in the frontend — a student with browser DevTools can call the API directly and bypass it.
This is an institutional trust issue, not just a UI bug.

## Context
- `backend/services/trainee.js` — contains student-accessible endpoints (EndTest, Answersheet, etc.)
- `backend/services/testpaper.js` — `getTestResultsList`, `getCandidates`, `sendResultEmail` 
  already ADMIN/TRAINER gated (safe). The risk is in trainee-side endpoints.
- `backend/routes/trainee.js` — trainee routes (no auth = public-ish routes)
- `backend/prisma/schema.prisma` — `Test.isResultgenerated` Boolean field exists
- The trainee result page at `/exam/results/[testId]/[traineeId]` fetches via an API call.
  That API call must be gated server-side.

## Tasks

<task type="auto">
  <name>Audit trainee.js for any endpoint that returns score/result data</name>
  <files>backend/services/trainee.js, backend/routes/trainee.js</files>
  <action>
    Search for all places that return `score`, `results`, `Result`, or `answerSheet` data
    to unauthenticated/trainee callers.
    
    For EVERY such endpoint that returns score or result data:
    1. Fetch the test record first: `const test = await prisma.test.findUnique({ where: { id: testId } })`
    2. Add a guard:
       ```js
       if (!test.isResultgenerated) {
         return res.status(403).json({ 
           success: false, 
           message: "Results have not been published yet." 
         });
       }
       ```
    3. Place the guard BEFORE any score/result data is included in the response.
    
    This guard must live in the SERVER handler — not the frontend component.
    
    Do NOT add this guard to:
    - Endpoints that are already protected by `requireRole('ADMIN', 'TRAINER')` — faculty need
      to see results before publishing them.
    - The `EndTest` submission endpoint — that should still work regardless.
  </action>
  <verify>curl -s -X POST http://localhost:5000/api/v1/trainee/result -H "Content-Type: application/json" -d "{\"testId\":\"UNPUBLISHED_TEST_ID\",\"traineeId\":\"ANY_ID\"}" | jq .message</verify>
  <done>Unpublished result endpoint returns 403 with "Results have not been published yet." Server-side check confirmed.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Manually verify the student result page respects the gate</name>
  <files>frontend-modern/src/app/exam/results/</files>
  <action>
    1. Start both backend and frontend.
    2. Create a test, register a trainee, complete the exam.
    3. Do NOT click "End Test" / publish results as faculty.
    4. Try to access `/exam/results/[testId]/[traineeId]` directly in the browser.
    5. Expected: Page shows "Results not yet published" — NOT the score.
    6. Open browser DevTools → Network tab → find the API call — confirm it returned 403.
    
    The 403 must come from the API response, not just a missing UI element.
  </action>
  <verify>Browser DevTools Network tab shows 403 on the result API call when results are unpublished.</verify>
  <done>Student cannot see score via API or UI before faculty publishes. Confirmed in Network tab.</done>
</task>

## Success Criteria
- [ ] All trainee-accessible score/result endpoints check `isResultgenerated` server-side
- [ ] An unpublished test returns HTTP 403 — not 200 with hidden data
- [ ] ADMIN/TRAINER endpoints are unaffected (they bypass the gate by role)
- [ ] Frontend result page shows a meaningful "not published yet" message on 403
