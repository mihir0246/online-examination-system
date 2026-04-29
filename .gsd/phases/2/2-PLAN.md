---
phase: 2
plan: 2
wave: 2
---

# Plan 2.2: Explicit Result Publishing Flag

## Objective
Add a `isResultPublished` boolean field to the Prisma `Test` model. 
Currently, `isResultgenerated` becomes true the moment the test ends (so the background job can generate the results).
However, faculty need a manual step to actually "Publish" these generated results to the students. 
We need a distinct field `isResultPublished` to control student visibility independently of whether the backend job has finished generating the scores.

## Context
- `backend/prisma/schema.prisma` — contains the `Test` model
- Needs a Prisma migration after updating the schema

## Tasks

<task type="auto">
  <name>Add isResultPublished to Test model</name>
  <files>backend/prisma/schema.prisma</files>
  <action>
    Add `isResultPublished Boolean @default(false)` to the `Test` model in `schema.prisma`.
    Place it near `isResultgenerated`.
  </action>
  <verify>Select-String -Path backend/prisma/schema.prisma -Pattern "isResultPublished"</verify>
  <done>Field exists in the schema.</done>
</task>

<task type="auto">
  <name>Generate and apply Prisma migration</name>
  <files>backend/prisma/migrations/</files>
  <action>
    Run `npx prisma migrate dev --name add_is_result_published` inside the `backend/` directory.
  </action>
  <verify>Get-ChildItem backend/prisma/migrations/*add_is_result_published</verify>
  <done>Migration folder exists and schema is in sync with database.</done>
</task>

<task type="auto">
  <name>Commit Plan 2.2 Schema Update</name>
  <files>backend/prisma/</files>
  <action>
    ```
    git add backend/prisma/
    git commit -m "feat(db): add isResultPublished flag to Test model"
    ```
  </action>
  <verify>git log --oneline -1</verify>
  <done>Commit exists with schema changes.</done>
</task>

## Success Criteria
- [ ] `isResultPublished` exists in `schema.prisma`
- [ ] Prisma migration is generated and applied
