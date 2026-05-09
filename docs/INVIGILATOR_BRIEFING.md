# Invigilator Briefing & Proctoring Guide

**System:** Online Examination System  
**Pilot Exam Date:** Monday, May 11, 2026  
**Exam Window:** 09:00 AM – 10:00 AM UTC (14:30 – 15:30 IST)  

---

## 📋 1. Role and Responsibilities
Invigilators are responsible for ensuring exam integrity, verifying student attendance, monitoring connection statuses, and resolving technical issues using the administrative dashboard.

---

## ⏱️ 2. Step-by-Step Exam Timeline

### T-30 Minutes: Setup & Verification
1. **Log In:** Access the **Trainer/Admin Dashboard** at the live frontend URL using your authorized trainer credentials.
2. **Verify Exam Config:** Go to the **Exams** tab and confirm the pilot exam details are correct:
   - Target questions are loaded.
   - `isRegistrationAvailable = true`.
   - `testbegins = false` (this prevents students from seeing any questions before the official start).
   - `testconducted = false`.
3. **Student Readiness:** Instruct students to navigate to the exam portal on their devices, log in or register, and wait on the "Waiting Room" screen.

### T-5 Minutes: Final Sync
1. Confirm all students are seated and have their devices powered on and connected to the local Wi-Fi.
2. Remind students that **screen locking or closing the tab** will temporarily pause their exam interface, but their progress is fully safe.

### T-0: Starting the Exam
1. **Activate Exam:** The lead invigilator/admin will click the **"Start Test"** button in the Admin Panel.
2. This action sets `testbegins = true` server-side, immediately releasing the randomized questions to the trainees.
3. Instruct students to refresh or click **"Begin Exam"** to load their questions and start the individual 60-minute countdown timers.

### Mid-Exam: Live Monitoring (T-0 to T+60 min)
1. Keep the **Active Trainees & Analytics Dashboard** open:
   - `GET /api/v1/trainer/active-trainees/:testId`
2. **Focus-Loss & Tab-Switch Tracking:**
   - The system monitors backgrounding, tab switches, and app switching.
   - If a student switches tabs or opens another application, the system triggers a `visibilitychange` warning.
   - These events are logged directly in the student's real-time audit log.
   - Check the logs and issue verbal warnings to students with multiple tab-switch alerts.
3. **Connectivity Status:**
   - A student's device sends a background heartbeat every 30 seconds.
   - If a student loses connection, their dashboard status card will transition from **"Active"** (green) to **"Disconnected"** (amber/red).

---

## ⚡ 3. Handling Network Disconnections & Screen Locks (Grace Period Policy)

Because this is a mobile-responsive web-app, students may experience brief disconnections or screen locks. **Do not panic; the system is designed to handle this seamlessly.**

### 3.1 Local Auto-Save (How It Works)
- **Instant Save:** Every time a student selects or changes an answer, it is immediately written to their browser's secure `localStorage` (via the `useAutoSave` hook).
- **Background Sync:** The client flushes pending answers to the remote server every 60 seconds, or instantly upon a tab switch or blur event.
- **Zero Data Loss:** If internet connectivity drops completely, the student can continue answering questions. Their answers are saved locally in the browser and will sync automatically once the connection is restored.

### 3.2 Screen Locks & Backgrounding
- When a mobile device locks, the browser suspends execution.
- **Action:** Instruct the student to unlock the device. The system will automatically fetch the exact server time (`now - startTime`) to sync their timer accurately. 
- If they locked their screen for more than 30 seconds, their card in the trainer dashboard may briefly show "Disconnected" until they resume.

### 3.3 Reconnection & Resuming (5-Minute Grace Period)
1. If a student's connection fails or their browser crashes:
   - They are granted a **5-minute grace period** to reconnect.
   - The countdown timer **continues running** on the server (they lose time spent offline, but they are not locked out).
2. **To Resume:**
   - Have the student reopen the browser/tab, log back in, and click "Resume Test".
   - The system retrieves their active state (active question index, remaining time, and previously flushed answers) from Redis, letting them resume immediately with zero lost progress.

---

## 🛠️ 4. Advanced Administrative Actions

### 4.1 Granting Time Extensions (Special Cases)
If a student experiences a verified hardware failure or long network disruption:
1. Locate the student in the **Active Trainees** list on the Admin Dashboard.
2. Click **"Extend Time"** next to their name.
3. Specify the duration (e.g., 5, 10, or 15 minutes) and click save.
4. The server will dynamically adjust their expiration window, and their client timer will instantly update without requiring a page reload.

### 4.2 Manual Submission / Force Close
If a student is caught violating exam integrity or refuses to submit at the end of their slot, the admin can click **"Force Submit"** next to their name to lock their answer sheet and calculate their score instantly based on current inputs.

---

## 📞 5. On-Call Escalation Matrix

If a critical system error occurs (e.g., dashboard fails to load, database connection errors), contact on-call support immediately:

| Role | Contact Name | Phone / Channel | Scope |
| :--- | :--- | :--- | :--- |
| **System Owner (Technical)** | Mihir | +1 (555) 019-2834 | Backend, AWS, DB & Redis Outages |
| **IT Network Contact** | Central NOC | +1 (555) 014-9821 | Campus Wi-Fi, Firewalls & LAN |
| **Academic Coordinator** | Dr. A. Sharma | +1 (555) 017-5329 | Exam Policy, Suspension & Scheduling |
