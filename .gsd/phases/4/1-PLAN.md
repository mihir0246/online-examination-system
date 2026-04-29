---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: PDF Parser Hardening — Stable Mixed-Type Question Extraction

## Objective
The `backend/services/questionParser.js` crashes when processing PDFs that contain:
- Mixed question types (MCQ questions followed by descriptive/TEXT questions in the same file)
- Table-formatted question layouts (rows/columns instead of line-by-line)
- Wrapped text lines that get split across multiple extracted text blocks

This blocks faculty from using bulk import — a critical workflow.

## Context
- `backend/services/questionParser.js` (~9KB) — main parser: `extractQuestionsFromFile()`,
  `parseTextToQuestions()`, `parseQFormat()`, `parseTableConcatenated()`, `cleanQuestion()`,
  `isWorthKeeping()`
- `backend/routes/fileUpload.js` — calls the parser after multer upload
- `backend/schemas/questions.js` (Zod schema in routes/questions.js) — must accept both MCQ and TEXT type
- The Zod schema currently may reject descriptive questions (no options array)

## Tasks

<task type="auto">
  <name>Add crash-safe error boundary and fix Zod schema for mixed types</name>
  <files>backend/services/questionParser.js, backend/routes/questions.js</files>
  <action>
    In `questionParser.js`:
    1. Wrap the entire `parseTextToQuestions()` body in try/catch per question block.
       Each failed question should push a `{ _error: true, raw: "..." }` object rather than
       crashing the whole parse. This means 1 bad question never aborts the full batch.
    
    2. In `isWorthKeeping()`: add a guard for TEXT/descriptive questions that have no options:
       ```js
       // Descriptive questions are valid with 0 options
       if (q.type === 'TEXT' || q.type === 'DESCRIPTIVE') return q.body?.trim().length > 5;
       ```
    
    In `backend/routes/questions.js` (or wherever Zod validation lives):
    3. Update the question Zod schema so `options` is optional for TEXT type:
       ```js
       const questionSchema = z.object({
         body: z.string().min(1),
         type: z.enum(['MCQ', 'TEXT']).default('MCQ'),
         weightage: z.number().default(1),
         explanation: z.string().optional().default(''),
         options: z.array(z.object({
           optbody: z.string(),
           isAnswer: z.boolean()
         })).optional().default([]),
       });
       ```
    4. For MCQ type, add a refinement: `.refine(q => q.type !== 'MCQ' || q.options.length >= 2, "MCQ needs at least 2 options")`
  </action>
  <verify>node -e "import('./services/questionParser.js').then(m => console.log('Parser loaded OK'))" 2>&1</verify>
  <done>Parser imports without error. A test run with a mixed PDF does not crash — partial results returned for bad blocks.</done>
</task>

<task type="auto">
  <name>Improve table-aware and line-join extraction</name>
  <files>backend/services/questionParser.js</files>
  <action>
    In `parseTableConcatenated()` and `parseTextToQuestions()`:
    
    1. **Line joining**: Before splitting into question blocks, join lines that don't start with
       a question number pattern (`/^\d+[.)]/`) to the previous line:
       ```js
       const joined = lines.reduce((acc, line) => {
         if (/^\d+[.)]/.test(line.trim()) || acc.length === 0) {
           acc.push(line);
         } else {
           acc[acc.length - 1] += ' ' + line.trim();
         }
         return acc;
       }, []);
       ```
    
    2. **Table row detection**: If a line contains multiple tab characters or 3+ spaces
       separating what look like question/option fragments, treat it as a table row and split
       on the delimiter rather than treating it as a single line.
    
    3. **Strip metadata tokens**: Expand `cleanQuestion()` to strip common table metadata:
       - CO/PO labels: `/\b(CO|PO)\d+\b/gi`
       - Marks labels: `/\b\d+\s*marks?\b/gi`
       - Bloom's taxonomy: `/\b(L1|L2|L3|L4|L5|L6|BTL-?\d)\b/gi`
    
    4. Return `{ questions: [...], errors: [...] }` from `extractQuestionsFromFile()` so the
       caller can show the user which blocks failed without hiding them.
  </action>
  <verify>node -e "
    import('./services/questionParser.js').then(async ({extractQuestionsFromFile}) => {
      // Simulate a minimal mixed text
      console.log('Table parse function exists:', typeof extractQuestionsFromFile === 'function');
    });
  " 2>&1</verify>
  <done>Parser returns `{ questions, errors }` shape. Mixed MCQ+TEXT input produces valid question objects without crash. Table PDF with CO/PO metadata strips cleanly.</done>
</task>

<task type="auto">
  <name>Commit parser fix</name>
  <files>backend/services/questionParser.js, backend/routes/questions.js</files>
  <action>
    ```
    git add backend/services/questionParser.js backend/routes/questions.js
    git commit -m "fix: harden PDF question parser — crash-safe mixed MCQ/TEXT, table-aware extraction, metadata stripping"
    ```
  </action>
  <verify>git log --oneline -1</verify>
  <done>Commit exists with parser fix message.</done>
</task>

## Success Criteria
- [ ] Parser never crashes on a mixed MCQ/TEXT PDF — partial results returned instead
- [ ] Zod schema accepts TEXT questions with zero options
- [ ] Table-formatted PDFs with CO/PO/Marks metadata parse correctly
- [ ] `extractQuestionsFromFile()` returns `{ questions, errors }` shape
- [ ] MCQ questions still require at least 2 options (refinement check)
