# Digital Personal Data Protection (DPDP) Act Compliance

This document formally details the data governance policies and workflows instituted within the Online Examination System to comply with the DPDP Act of India.

## 1. Data Processing Register & Legal Basis
The primary legal basis for processing student data is **Consent** (Section 6). The system automatically records the exact timestamp (`consentGivenAt`) when a student registers for an exam.
- **Purpose of Processing**: To authenticate the student, administer the academic assessment, record their answers, and issue a graded result.
- **Third-Party Sub-Processors**: 
  - MongoDB Atlas (Primary Database Storage)
  - AWS Elastic Beanstalk / S3 (Application Hosting & File Attachments)
  - Redis / ElastiCache (Ephemeral State Management)

## 2. PII Inventory (What we collect)
- **Direct PII**: Name, Email Address, Contact Number, Organisation/College, Location.
- **Academic PII**: Exam Answers, Assessment Scores, Graded Results, Feedback provided.
- **Behavioural PII (Audit Logs)**: IP Addresses, Tab-switch frequencies, Browser defocussing timestamps.

## 3. Retention Periods
Data is not held indefinitely. The retention schedules are defined based on institutional academic requirements and the data minimization principle.
- **Academic Records (Exam Results & Answers)**: 5 Years. *Legal Basis: Institutional requirement for degree validation and long-term academic record keeping.*
- **Security & Event Audit Logs (`ExamEvent`)**: 90 Days. *Legal Basis: Short-term forensic analysis for grade disputes or cheating allegations.* (Enforced automatically via MongoDB TTL index).
- **Ephemeral State (Redis)**: Maximum 24 hours. (Enforced via Redis EX expiry).

## 4. Right to Data Portability (Data Export)
Under DPDP, Data Principals (Students) have the right to obtain a copy of their personal data.
- **Mechanism**: The student requests their data via the authenticated endpoint `GET /api/v1/trainee/export-my-data`.
- **Format**: A structured JSON bundle containing their Profile, Exam History, Submitted Answers, and Behavioural Events.
- **Exclusions**: The export excludes institutional security records such as the raw IP addresses stored in the `AuditLog`.

## 5. Right to Erasure (Deletion Workflow) & Consent Withdrawal
A student can withdraw consent at any time, invoking their Right to Erasure.
- **Mechanism**: The student submits a formal request to the Academic Coordinator. The Administrator triggers the `DELETE /api/v1/admin/trainee/:id` API.
- **Data Destruction (Cascade)**: The system automatically wipes the student's Profile, Answer Sheets, Results, Exam Events, Feedback, S3 attachments, and active Redis sessions.
- **Anonymisation**: Institutional `AuditLog` records attached to the student are *anonymised* rather than deleted. The `traineeId` is replaced with `[DELETED]` and the `ip` address is replaced with `[REDACTED]`. This preserves the historical record of an exam event without retaining PII.
- **Irreversibility**: Deletions are hard-deletes. There is no cooling-off period. Once the API is called, the data is permanently destroyed.

## 6. Personal Data Breach Notification Procedure
In the event of unauthorized access or a data leak from the MongoDB Atlas cluster or AWS environment, the following 72-hour workflow is triggered:
1. **Hour 0-24 (Containment & Assessment)**: The System Owner isolates the breach (e.g., rotating MongoDB credentials, terminating compromised instances).
2. **Hour 24-48 (Data Protection Board Notification)**: The System Owner formally notifies the Data Protection Board of India detailing the nature of the breach, the volume of data affected, and the mitigation steps taken.
3. **Hour 48-72 (Data Principal Notification)**: The Academic Coordinator executes a mass communication (via the `sendmail` module or external CRM) to all affected students, advising them of the breach and any steps they should take (e.g., password resets if credentials were shared).
