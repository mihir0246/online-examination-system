/**
 * Plan 2.2: useAutoSave — Background Auto-Save with LocalStorage Buffering
 *
 * Strategy:
 * 1. Every answer change is written to localStorage immediately (zero latency UX)
 * 2. A background interval syncs pending changes to the backend every 5 seconds
 * 3. On tab visibility change (blur/hidden) the queue is flushed immediately
 * 4. On beforeunload, a synchronous localStorage write ensures nothing is lost
 * 5. On mount, any un-synced answers from a previous session are replayed
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import apiClient from '@/services/apiClient';

interface PendingAnswer {
  qid: string;
  newAnswer: string | string[];
  isBookmarked?: boolean;
  timestamp: number;
}

interface AutoSaveOptions {
  testId: string;
  traineeId: string;
  intervalMs?: number;  // default 5000ms
  onSyncError?: (err: unknown) => void;
}

const STORAGE_PREFIX = 'exam_autosave';

const getStorageKey = (testId: string, traineeId: string) =>
  `${STORAGE_PREFIX}:${testId}:${traineeId}`;

export const useAutoSave = ({
  testId,
  traineeId,
  intervalMs = 5000,
  onSyncError,
}: AutoSaveOptions) => {
  // Pending answers not yet synced to backend
  const pendingRef = useRef<Map<string, PendingAnswer>>(new Map());
  const isSyncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load any previously unsynced answers from localStorage ──────────────────
  useEffect(() => {
    if (!testId || !traineeId) return;
    try {
      const raw = localStorage.getItem(getStorageKey(testId, traineeId));
      if (raw) {
        const saved: PendingAnswer[] = JSON.parse(raw);
        saved.forEach((a) => pendingRef.current.set(a.qid, a));
      }
    } catch (_) { /* ignore parse errors */ }
  }, [testId, traineeId]);

  // ── Write pending map to localStorage (called on every change) ──────────────
  const persistToStorage = useCallback(() => {
    if (!testId || !traineeId) return;
    try {
      const items = Array.from(pendingRef.current.values());
      if (items.length > 0) {
        localStorage.setItem(getStorageKey(testId, traineeId), JSON.stringify(items));
      } else {
        localStorage.removeItem(getStorageKey(testId, traineeId));
      }
    } catch (_) { /* storage quota exceeded — ignore */ }
  }, [testId, traineeId]);

  // ── Flush all pending answers to the backend ─────────────────────────────────
  const flushToBackend = useCallback(async () => {
    if (isSyncingRef.current || pendingRef.current.size === 0) return;
    isSyncingRef.current = true;

    const snapshot = Array.from(pendingRef.current.values());
    try {
      await Promise.all(
        snapshot.map((a) =>
          apiClient.post('/api/v1/trainee/update/answer', {
            testid: testId,
            userid: traineeId,
            qid: a.qid,
            newAnswer: a.newAnswer,
            isBookmarked: a.isBookmarked ?? false,
          })
        )
      );
      // Remove synced answers from pending map
      snapshot.forEach((a) => pendingRef.current.delete(a.qid));
      persistToStorage();
    } catch (err) {
      onSyncError?.(err);
      // Keep answers in pending — will retry on next interval
    } finally {
      isSyncingRef.current = false;
    }
  }, [testId, traineeId, onSyncError, persistToStorage]);

  // ── Start background sync interval ──────────────────────────────────────────
  useEffect(() => {
    if (!testId || !traineeId) return;

    intervalRef.current = setInterval(flushToBackend, intervalMs);

    // Flush immediately when tab becomes hidden (user switches away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushToBackend();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Best-effort flush on page unload (synchronous localStorage write is guaranteed)
    const handleBeforeUnload = () => {
      persistToStorage(); // localStorage is synchronous — this always completes
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [testId, traineeId, intervalMs, flushToBackend, persistToStorage]);

  // ── Public API: call this on every answer change ─────────────────────────────
  const saveAnswer = useCallback(
    (qid: string, newAnswer: string | string[], isBookmarked?: boolean) => {
      // 1. Update pending map (overwrites any previous pending save for same qid)
      pendingRef.current.set(qid, {
        qid,
        newAnswer,
        isBookmarked,
        timestamp: Date.now(),
      });
      // 2. Persist to localStorage immediately (survives tab crash)
      persistToStorage();
    },
    [persistToStorage]
  );

  // ── Clear saved state after test submission ──────────────────────────────────
  const clearSavedState = useCallback(() => {
    pendingRef.current.clear();
    if (testId && traineeId) {
      localStorage.removeItem(getStorageKey(testId, traineeId));
    }
  }, [testId, traineeId]);

  return {
    saveAnswer,
    flushToBackend,
    clearSavedState,
    pendingCount: pendingRef.current.size,
  };
};
