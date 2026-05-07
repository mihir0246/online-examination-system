# Audit Trail User Guide

This guide is designed for Administrators, Trainers, and Academic Coordinators. It explains how to use the backend Audit API endpoints to resolve grade disputes, investigate cheating allegations, or verify technical failures during an exam.

## 1. What Data is Collected?
The system captures two types of data during an exam:
- **Lifecycle & Security Logs (`/api/v1/audit/logs`)**: High-fidelity records of critical actions (Test Published, Answers Saved, Results Generated) and security violations (Identity Spoofing, Deadline Bypasses).
- **Ephemeral Exam Events (`/api/v1/audit/events`)**: High-volume, non-critical metrics (e.g., when a student switches away from the exam tab or loses browser focus). *Note: These records are permanently deleted after 90 days.*

## 2. How to Pull a Trainee's Event Timeline
If a student disputes a grade or reports a technical failure mid-exam, you can reconstruct their exact timeline.

**Using an API Client (Postman/cURL):**
Send a `POST` request to `/api/v1/audit/logs` with your Trainer `Authorization: Bearer <token>` header.

**Request Body:**
```json
{
  "testId": "66d1f0...",
  "page": 1,
  "limit": 100
}
```
*(Note: You can only query tests that you have created. Attempting to query another trainer's test will return a 403 Forbidden.)*

## 3. Interpreting the Events

### A. Troubleshooting "Lost Answers"
Filter the audit response for `event: "ANSWER_SAVED"` matching the student's `traineeId`.
- **Meaning**: The server successfully received and persisted the student's answer choice to the database at that exact timestamp.
- **Dispute Resolution**: If a student claims they clicked an answer but the system didn't save it, the presence of an `ANSWER_SAVED` log proves the system captured it. If the log is missing, the student either did not click the answer, or they lost internet connection before the request reached the server.

### B. Investigating Cheating/Impersonation
Filter for `event: "OWNERSHIP_VIOLATION"`.
- **Meaning**: An attacker (or misconfigured script) attempted to submit an answer by spoofing another student's ID.
- **Dispute Resolution**: Look at the `metadata.claimedId` and the `ip` address. A sustained spike of these events indicates an active attack.

### C. Investigating Late Submissions
Filter for `event: "EXAM_WINDOW_VIOLATION"`.
- **Meaning**: The student attempted to submit an answer after the exam timer hit zero (plus the 60-second network grace period).
- **Dispute Resolution**: The system automatically rejects these answers. The log records the `expectedDeadline` and the `deltaSeconds` (how late they were).

### D. Reconstructing Browser Defocus
Send a `POST` request to `/api/v1/audit/events` with the `testId` and `traineeId`.
- **Meaning**: A high concentration of `BLUR` events indicates the student frequently clicked out of the exam window (potentially searching Google or opening another app). 
- **Dispute Resolution**: Can be used alongside video proctoring footage to corroborate suspicious behavior.
