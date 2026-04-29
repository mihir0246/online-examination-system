import { App } from 'antd';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { useAutoSave } from './useAutoSave';

export const useExamSession = (testId: string, traineeId: string) => {
  const { message } = App.useApp();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExamOver, setIsExamOver] = useState(false);
  const [testNotStarted, setTestNotStarted] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  // LOCAL optimistic answer cache — avoids re-fetching after every save
  const [localAnswers, setLocalAnswers] = useState<Record<string, { options: string[]; isBookmarked: boolean }>>({});

  // --- Plan 2.2: Auto-save hook for background syncing and crash recovery ---
  const { saveAnswer: backgroundSave, clearSavedState, flushToBackend } = useAutoSave({
    testId,
    traineeId,
    onSyncError: (err) => {
      console.warn('Auto-save sync error:', err);
      setConnectionError(true);
    }
  });

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['exam-session', testId, traineeId],
    queryFn: async () => {
      try {
        const [questionsRes, answersRes, traineeRes] = await Promise.all([
          apiClient.post('/api/v1/trainee/paper/questions', { id: testId }),
          apiClient.post('/api/v1/trainee/answersheet', { testid: testId, userid: traineeId }),
          apiClient.post('/api/v1/trainee/details', { userid: traineeId })
        ]);
        
        const sheet = answersRes.data.data;
        const duration = answersRes.data.duration || 60;
        const savedState = answersRes.data.savedState; // Plan 2.3: Restored state from Redis
        
        const startTime = sheet?.startTime || Math.floor(Date.now() / 1000);
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - startTime;
        const serverRemaining = (duration * 60) - elapsed;
        
        // --- Plan 2.3: Restore saved state (index and time) if available ---
        if (savedState) {
          setActiveQuestionIndex(savedState.currentQuestionIdx || 0);
          // Prefer saved remaining time if it's more accurate/recent
          if (savedState.remainingTime) {
            setTimeLeft(Math.min(serverRemaining, savedState.remainingTime));
          } else {
            setTimeLeft(Math.max(0, serverRemaining));
          }
        } else {
          setTimeLeft(Math.max(0, serverRemaining));
        }

        setTestNotStarted(false);
        setConnectionError(false);

        // Seed localAnswers from server data (only on initial load)
        const serverAnswers = sheet?.answers || [];
        const answerMap: Record<string, { options: string[]; isBookmarked: boolean }> = {};
        serverAnswers.forEach((a: any) => {
          answerMap[a.questionId] = { options: a.options || [], isBookmarked: !!a.isBookmarked };
        });
        setLocalAnswers(prev => ({ ...answerMap, ...prev }));

        return {
          questions: questionsRes.data.data,
          answers: serverAnswers,
          trainee: traineeRes.data.data
        };
      } catch (err: any) {
        if (err.response?.status === 400) {
          console.warn('Test session not live yet (400). Showing waiting screen.');
          setTestNotStarted(true);
          return null;
        }

        if (!err.response) {
          console.warn('Network error or backend is down:', err.message);
          setConnectionError(true);
          return null;
        }
        
        console.error('Exam session critical fetch error:', err.response?.status, err.response?.data || err.message);
        throw err;
      }
    },
    enabled: !!testId && !!traineeId,
    refetchInterval: (testNotStarted || connectionError) ? 5000 : false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 400) return false;
      return failureCount < 2;
    },
    staleTime: Infinity, // Keep data in cache, only refresh manually or via focus
  });

  const queryClient = useQueryClient();
  
  // --- Plan 2.3: Periodically sync current question index and time to server ---
  useEffect(() => {
    if (!testId || !traineeId || timeLeft === null || testNotStarted || isExamOver) return;

    const syncInterval = setInterval(() => {
      apiClient.post('/api/v1/trainee/sync-state', {
        testid: testId,
        userid: traineeId,
        currentQuestionIdx: activeQuestionIndex,
        remainingTime: timeLeft
      }).catch(err => console.warn('State sync failed:', err));
    }, 10000); // Sync state every 10 seconds

    return () => clearInterval(syncInterval);
  }, [testId, traineeId, activeQuestionIndex, timeLeft, testNotStarted, isExamOver]);

  const submitExamMutation = useMutation({
    mutationFn: async () => {
      // Flush any pending auto-saves before submitting
      await flushToBackend();
      
      const { data } = await apiClient.post('/api/v1/trainee/end/test', {
        testid: testId,
        userid: traineeId
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setIsExamOver(true);
        clearSavedState(); // Clean up localStorage
        message.success('Examination submitted successfully!');
      }
    }
  });

  // Timer Logic
  useEffect(() => {
    if (timeLeft === null || testNotStarted || isExamOver) return;
    if (timeLeft <= 0) {
      submitExamMutation.mutate();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, testNotStarted, isExamOver]);

  const saveAnswer = async (questionId: string, answer: any, isBookmarked: boolean) => {
    // 1. Update local state immediately (optimistic UI)
    const options = answer ? (Array.isArray(answer) ? answer : [answer]) : [];
    setLocalAnswers(prev => ({
      ...prev,
      [questionId]: {
        options,
        isBookmarked
      }
    }));
    
    // 2. Queue for background auto-save (Plan 2.2)
    backgroundSave(questionId, options, isBookmarked);
  };

  // Build merged answers array: server data overridden by local optimistic state
  const mergedAnswers = [
    ...(sessionData?.answers || []).map((a: any) => ({
      ...a,
      ...(localAnswers[a.questionId] || {})
    }))
  ];

  // Also add any locally-answered questions not yet confirmed from server
  const serverQuestionIds = new Set((sessionData?.answers || []).map((a: any) => a.questionId));
  Object.entries(localAnswers).forEach(([qid, val]) => {
    if (!serverQuestionIds.has(qid)) {
      mergedAnswers.push({ questionId: qid, ...val });
    }
  });

  return {
    questions: sessionData?.questions || [],
    answers: mergedAnswers,
    localAnswers,
    activeQuestionIndex,
    setActiveQuestionIndex,
    timeLeft,
    setTimeLeft,
    trainee: sessionData?.trainee,
    isLoading,
    isExamOver,
    testNotStarted,
    connectionError,
    saveAnswer,
    submitExam: submitExamMutation.mutateAsync,
    isSubmitting: submitExamMutation.isPending
  };
};

