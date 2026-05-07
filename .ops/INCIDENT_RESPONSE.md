# Incident Response Playbook

This playbook provides standard operating procedures for handling production disruptions during live exam windows. Do not improvise during a crisis—follow the decision trees below.

## 1. On-Call Contacts
During active exam windows, the following personnel must be reachable via mobile/SMS:
- **System Owner (Technical)**: [Insert Name / Phone]
- **College IT Contact (Infrastructure/Network)**: [Insert Name / Phone]
- **Academic Coordinator (Student Comms)**: [Insert Name / Phone]

## 2. Sentry Alert Routing & Escalation
- **Non-Exam Hours**: All errors are routed to the central operations email.
- **Exam Windows**: A dedicated Sentry alert rule triggers Push Notifications / SMS (via Twilio/PagerDuty) for critical errors (`5xx`, `OWNERSHIP_VIOLATION`, `AUTH_FAILURE`). A 5-minute email delay is unacceptable during an active test.

## 3. Disruption Scenarios & Playbooks

### Scenario A: Submission Endpoint Down During Active Exam
**Detection**: `ExamSystem-5xxErrorRate` CloudWatch alarm fires OR Sentry reports `500 Internal Server Error` on `/end/test` or `/update/answer`.
**Immediate Action**:
1. Check CloudWatch/Beanstalk logs for database connection timeouts or OOM errors.
2. System Owner manually extends the exam window via the Admin UI to prevent students from being locked out.
3. Academic Coordinator triggers **Communication Template 1**.

### Scenario B: Student Reports Answer Loss Mid-Exam
**Detection**: Student contacts proctor/support stating their selected option disappeared upon refresh.
**Investigation**:
1. Go to Admin Audit Logs and search for `ANSWER_SAVED` events for that `traineeId`.
2. Compare the server-side audit timestamp with the student's report.
3. If auto-save is functioning, instruct the student to continue.
4. Academic Coordinator triggers **Communication Template 2**.

### Scenario C: Security Spike (`OWNERSHIP_VIOLATION` or `AUTH_FAILURE`)
**Detection**: MongoDB Audit Event Spike Alarm (Atlas Trigger -> CloudWatch) reports > 10 violations in 5 minutes.
**Investigation**:
1. Check `AuditLog` in Prisma Studio or Admin UI.
2. Is the spike coming from a single IP? (Likely script/attack) -> Block IP at WAF/ALB.
3. Is it coming from many IPs with the same `claimedId`? (Frontend state bug).
4. Decide whether to suspend the exam based on the Decision Tree below.

## 4. Exam Suspension Decision Tree
**Who decides?** The Academic Coordinator holds the ultimate authority to suspend an exam. The System Owner provides the technical recommendation.

- **Threshold for Suspension**:
  - Sustained 5xx error rate > 5% for more than 10 minutes.
  - Active, distributed data tampering (widespread `OWNERSHIP_VIOLATION` that cannot be IP-blocked).
  - Complete database outage (Atlas unreachable).
- **If Suspended**: Academic Coordinator triggers **Communication Template 3**.

## 5. Communication Templates

**Template 1: Exam Disrupted — Time Extended**
> "We are currently experiencing technical difficulties processing submissions. Please do not panic. Your answers are auto-saved. The exam deadline has been officially extended by X minutes to compensate for this delay."

**Template 2: Investigating Submission Issue**
> "We have received your report regarding missing answers. Our technical team is verifying the server-side auto-save logs. Please continue with the rest of the exam while we investigate."

**Template 3: Exam Suspended — Rescheduling**
> "Due to a critical infrastructure failure, the current examination is suspended immediately. All progress up to this point has been secured. The academic department will contact you shortly with the rescheduled exam date and time."
