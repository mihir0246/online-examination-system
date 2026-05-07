# Grace Period & Disconnection Policy

This document defines the official system behavior and institutional policy for handling network disconnections, screen locks, and backgrounded browser tabs during an active online examination.

## 1. Local Auto-Save & Data Integrity
The Online Examination System uses a hybrid local/remote state management approach:
- **Instant Local Save:** Every answer selected or typed is instantly written to the browser's `localStorage` (via the `useAutoSave` hook).
- **Background Sync:** The system silently syncs pending local answers to the backend every 60 seconds or on immediate tab switch.
- **Data Guarantee:** If a connection drops, the student's work is preserved locally. When the connection returns, the system automatically flushes the local answers to the server.

## 2. Token Expiry & Mid-Exam Disconnects
- **Token Expiration:** If the authentication token expires mid-exam and the silent refresh fails, the exam UI **will not crash or log the student out**.
- **Offline Indicator:** The system will display an offline/reconnecting indicator at the top of the screen.
- **Continued Exam Flow:** Students can continue answering questions locally while offline. Their work is safe. Once the connection is re-established (e.g., they manually refresh or the background sync succeeds), the queued data is securely submitted.

## 3. Mobile-Specific Behaviors
Mobile devices (iOS Safari, Android Chrome) introduce specific technical challenges:

### 3.1 Screen Locks
- **Behavior:** When a phone's screen locks, the mobile OS typically suspends the browser tab, pausing JavaScript execution (including the countdown timer and auto-save loops).
- **System Handling:** 
  - Upon unlocking the device, the `useExamSession` hook will recalculate the remaining time based on the **server's timestamp** (`now - startTime`), preventing any timer exploits.
  - The heartbeat mechanism will temporarily halt during a screen lock. Invigilators will see the student marked as "Disconnected" if the lock exceeds 30 seconds.

### 3.2 Suspended Tabs (Switching Apps)
- **Behavior:** If a student switches to another app (e.g., WhatsApp, Calculator), the exam tab is backgrounded.
- **Proctoring Impact:** The system instantly triggers a `visibilitychange` event.
  - The frontend automatically flushes any unsaved answers to the backend immediately upon detecting the blur event.
  - A tab-switch warning is logged to the backend via the `useProctoring` hook.
  - The student will see an on-screen warning ("Tab switch detected!") upon returning.

## 4. Institutional Grace Period Policy
Because mobile connections drop and screens lock, the following academic policies apply:

1. **Reconnection Window:** Students are granted a default grace period (e.g., 5 minutes) to reconnect if their heartbeat drops. The exam session remains live on the server.
2. **Resume Capability:** If a student accidentally closes the tab or browser, they can re-click the exam link, log in, and click "Start Test" again. The system will retrieve their `currentQuestionIdx`, `remainingTime`, and previously submitted answers, allowing them to resume exactly where they left off.
3. **No Time Extension:** The overall exam window (e.g., 60 minutes) ticks continuously on the server regardless of local disconnections. The student loses any time spent offline.

## 5. Invigilator Actions
If a student remains disconnected beyond the grace period:
- Invigilators can view the exact timestamp of the last successful heartbeat in the Admin Dashboard (`app/dashboard/tests/[testId]/analytics`).
- If suspicious activity is detected (e.g., frequent brief disconnects or excessive tab switches), the Invigilator may manually pause or terminate the student's session.
