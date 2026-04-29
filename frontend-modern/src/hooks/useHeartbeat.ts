'use client';

/**
 * Plan 3.3: useHeartbeat — sends a periodic ping to the backend to signal
 * that the trainee is still active in their exam session.
 *
 * The backend stores a Redis key with a 45s TTL per ping.
 * The trainer's monitoring dashboard polls /api/v1/trainer/active-trainees/:testId
 * to see who's still online.
 */
import { useEffect, useRef } from 'react';
import apiClient from '@/services/apiClient';

interface HeartbeatOptions {
  testId: string;
  traineeId: string;
  intervalMs?: number;   // default 30s
  enabled?: boolean;     // set false to pause (e.g. after exam is over)
}

export const useHeartbeat = ({
  testId,
  traineeId,
  intervalMs = 30_000,
  enabled = true,
}: HeartbeatOptions) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendPing = () => {
    if (!testId || !traineeId) return;
    // Fire-and-forget — heartbeat failures are non-critical
    apiClient
      .post('/api/v1/trainee/heartbeat', { testid: testId, userid: traineeId })
      .catch(() => {/* silently ignore — server logs the miss */});
  };

  useEffect(() => {
    if (!enabled || !testId || !traineeId) return;

    // Send immediately on mount so the trainer sees the student right away
    sendPing();
    intervalRef.current = setInterval(sendPing, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [testId, traineeId, intervalMs, enabled]);
};
