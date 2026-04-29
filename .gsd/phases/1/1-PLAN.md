---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: ORM Consolidation — Remove Mongoose, Keep Prisma

## Objective
Eliminate Mongoose entirely so there is exactly ONE ORM writing to MongoDB.
Currently `app.js` calls `mongoose.connect()` alongside Prisma's own connection pool — two separate
connection pools are open to the same database. The `backend/schemas/` directory holds 11 stale
Mongoose schema files that are no longer imported anywhere; they are dead code and confuse any
reader (or AI reviewer) about where the real schema lives.

**Decision:** Prisma stays (full schema.prisma exists, all services already use `prisma.*`).
Mongoose goes.

## Context
- `backend/app.js` — contains `import mongoose` + `mongoose.connect()` block (lines 14, 49–58)
- `backend/package.json` — `"mongoose": "^8.11.1"` must be removed
- `backend/schemas/` — 11 files: `answers.js`, `answersheet.js`, `feedback.js`, `options.js`,
  `questions.js`, `results.js`, `subResults.js`, `subjects.js`, `Test.js`, `testpaper.js`, `user.js`
  — all use `require("mongoose")`, none are imported by any service file
- `backend/services/prisma.js` — Prisma client (this stays, this is the real DB layer)
- `backend/prisma/schema.prisma` — authoritative data model (this stays)

## Tasks

<task type="auto">
  <name>Remove mongoose from app.js</name>
  <files>backend/app.js</files>
  <action>
    1. Delete line 14: `import mongoose from 'mongoose';`
    2. Delete the entire mongoose.connect block (lines 47–58):
       ```
       const MONGO_URI = process.env.DATABASE_URL || process.env.MONGO_URI;
       mongoose.connect(MONGO_URI, {
         maxPoolSize: 100,
         socketTimeoutMS: 45000,
         connectTimeoutMS: 30000,
         family: 4,
       }).then(() => {
         logger.info("🍃 MongoDB Connected with tuned connection pool");
       }).catch(err => {
         logger.error(`❌ MongoDB Connection Error: ${err.message}`);
       });
       ```
    3. Prisma manages its own connection pool via DATABASE_URL — no replacement needed.
    4. Keep the logger.info startup message: add one line after `initSocket(httpServer)`:
       `logger.info("🍃 Prisma client initialized — MongoDB connection managed by Prisma");`
    
    Do NOT remove any other imports or middleware.
  </action>
  <verify>node --input-type=module &lt;&lt;&lt; "import './app.js'" 2>&1 | Select-String "mongoose"</verify>
  <done>No "mongoose" string appears in app.js output. Server starts without error.</done>
</task>

<task type="auto">
  <name>Uninstall mongoose and delete stale schemas/</name>
  <files>backend/package.json, backend/schemas/*</files>
  <action>
    1. Run: `npm uninstall mongoose` inside the `backend/` directory.
       This removes mongoose from package.json and package-lock.json.
    
    2. Delete the entire `backend/schemas/` directory.
       These 11 files are dead code — no service imports from them since the Prisma migration:
       answers.js, answersheet.js, feedback.js, options.js, questions.js, results.js,
       subResults.js, subjects.js, Test.js, testpaper.js, user.js
    
    3. Verify no file in `backend/services/` or `backend/routes/` imports from `../schemas/`:
       Run: `grep -r "schemas" backend/services/ backend/routes/`
       Expected result: NO output (zero matches).
    
    Do NOT delete `backend/prisma/schema.prisma` — that is the keeper.
  </action>
  <verify>grep -r "from.*schemas" backend/services/ backend/routes/ 2>&1; echo "Exit: $LASTEXITCODE"</verify>
  <done>Zero matches for schemas imports. `backend/schemas/` directory does not exist. `mongoose` absent from package.json.</done>
</task>

<task type="auto">
  <name>Update STATE.md and commit</name>
  <files>.gsd/STATE.md</files>
  <action>
    1. Update STATE.md to reflect Phase 1 complete.
    2. Stage and commit:
       ```
       git add backend/app.js backend/package.json backend/package-lock.json
       git rm -r backend/schemas/
       git add .gsd/ROADMAP.md .gsd/STATE.md .gsd/phases/1/1-PLAN.md
       git commit -m "refactor: remove Mongoose, consolidate to Prisma as single ORM"
       ```
  </action>
  <verify>git log --oneline -1</verify>
  <done>Commit exists with message containing "remove Mongoose". Server starts cleanly.</done>
</task>

## Success Criteria
- [ ] `import mongoose` is gone from `app.js`
- [ ] `mongoose.connect()` block is gone from `app.js`
- [ ] `"mongoose"` is absent from `backend/package.json` dependencies
- [ ] `backend/schemas/` directory does not exist
- [ ] Zero imports of `../schemas/` anywhere in services or routes
- [ ] `npm start` in backend runs without any mongoose-related warning or error
