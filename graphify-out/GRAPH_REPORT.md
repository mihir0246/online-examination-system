# Graph Report - Online-Examination-System  (2026-04-24)

## Corpus Check
- 45 files · ~10,896 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 150 nodes · 120 edges · 8 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Test Paper Service|Test Paper Service]]
- [[_COMMUNITY_Question Parser|Question Parser]]
- [[_COMMUNITY_Mail and Socket|Mail and Socket]]
- [[_COMMUNITY_Trainer Functions|Trainer Functions]]
- [[_COMMUNITY_Auth Login|Auth Login]]
- [[_COMMUNITY_Redis Cache|Redis Cache]]
- [[_COMMUNITY_useExam Hook|useExam Hook]]
- [[_COMMUNITY_Exam Portal Errors|Exam Portal Errors]]

## God Nodes (most connected - your core abstractions)
1. `parseTextToQuestions()` - 6 edges
2. `parseQFormat()` - 4 edges
3. `handleSaveAndNext` - 4 edges
4. `currentAnswer (answers.find by questionId)` - 4 edges
5. `cleanQuestion()` - 3 edges
6. `isWorthKeeping()` - 3 edges
7. `getIO()` - 3 edges
8. `traineeenter()` - 3 edges
9. `currentQuestion.id (Prisma field)` - 3 edges
10. `saveAnswer(questionId, answer, isBookmarked)` - 3 edges

## Surprising Connections (you probably didn't know these)
- `currentAnswer (answers.find by questionId)` --references--> `Answer.questionId (String @db.ObjectId)`  [INFERRED]
  frontend-modern/src/app/exam/portal/[testId]/[traineeId]/page.tsx → backend/prisma/schema.prisma
- `currentQuestion.id (Prisma field)` --references--> `Question.id (Prisma ObjectId @id)`  [EXTRACTED]
  frontend-modern/src/app/exam/portal/[testId]/[traineeId]/page.tsx → backend/prisma/schema.prisma
- `result()` --calls--> `uploadToS3()`  [INFERRED]
  C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\excel.js → C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\s3.js
- `traineeenter()` --calls--> `sendmail()`  [INFERRED]
  C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\trainee.js → C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\mail.js
- `beginTest()` --calls--> `getIO()`  [INFERRED]
  C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\testpaper.js → C:\Users\mihir\OneDrive\Desktop\exam management system\Online-Examination-System\backend\services\socket.js

## Hyperedges (group relationships)
- **Bookmark and Save-and-Next Full Flow** — page_handlesaveandnext, page_handletogglebookmark, session_saveanswer, session_saveanswermutation, apiclient_post_updateanswer, backend_updateanswers [EXTRACTED 1.00]
- **invalidateQueries -> Answersheet 400 Risk Loop** — session_invalidatequeries, session_usequery_examfetch, apiclient_post_answersheet, backend_answersheet, bug_invalidate_triggers_400 [INFERRED 0.85]

## Communities

### Community 1 - "Test Paper Service"
Cohesion: 0.15
Nodes (16): POST /api/v1/trainee/update/answer, Answer.questionId (String @db.ObjectId), Question.id (Prisma ObjectId @id), answerSheet.findFirst + answers join, UpdateAnswers backend handler, BUG: currentAnswer useEffect infinite loop risk, BUG: question.id vs question._id mismatch, currentAnswer (answers.find by questionId) (+8 more)

### Community 2 - "Question Parser"
Cohesion: 0.14
Nodes (2): MaxMarks(), MM()

### Community 3 - "Mail and Socket"
Cohesion: 0.62
Nodes (6): cleanQuestion(), extractQuestionsFromFile(), isWorthKeeping(), parseQFormat(), parseTableConcatenated(), parseTextToQuestions()

### Community 4 - "Trainer Functions"
Cohesion: 0.29
Nodes (4): sendmail(), getIO(), beginTest(), traineeenter()

### Community 7 - "Auth Login"
Cohesion: 0.5
Nodes (5): POST /api/v1/trainee/answersheet, Answersheet backend handler (400 if testbegins=false), BUG: invalidateQueries re-triggers Answersheet 400, queryClient.invalidateQueries([exam-session]), useQuery: fetch questions+answersheet+trainee

### Community 8 - "Redis Cache"
Cohesion: 0.5
Nodes (2): result(), uploadToS3()

### Community 13 - "useExam Hook"
Cohesion: 1.0
Nodes (2): generateResults(), gresult()

### Community 45 - "Exam Portal Errors"
Cohesion: 1.0
Nodes (1): Testquestions backend handler

## Knowledge Gaps
- **4 isolated node(s):** `isBookmarked state`, `Testquestions backend handler`, `answerSheet.findFirst + answers join`, `Question.id (Prisma ObjectId @id)`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Question Parser`** (15 nodes): `testpaper.js`, `basicTestdetails()`, `checkTestName()`, `createEditTest()`, `deleteTest()`, `endTest()`, `getAlltests()`, `getCandidateDetails()`, `getCandidates()`, `getSingletest()`, `getTestquestions()`, `getTestStats()`, `MaxMarks()`, `MM()`, `TestDetails()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Redis Cache`** (4 nodes): `excel.js`, `s3.js`, `result()`, `uploadToS3()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useExam Hook`** (3 nodes): `generateResults.js`, `generateResults()`, `gresult()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Exam Portal Errors`** (1 nodes): `Testquestions backend handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `traineeenter()` connect `Trainer Functions` to `Trainee Service`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `beginTest()` connect `Trainer Functions` to `Question Parser`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `currentAnswer (answers.find by questionId)` (e.g. with `Answer.questionId (String @db.ObjectId)` and `BUG: question.id vs question._id mismatch`) actually correct?**
  _`currentAnswer (answers.find by questionId)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `isBookmarked state`, `Testquestions backend handler`, `answerSheet.findFirst + answers join` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trainee Service` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Question Parser` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._