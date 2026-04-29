'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';

export interface TestDetails {
  id: string;
  title: string;
  type: string;
  duration: number;
  difficulty: number;
  organisation: string;
  status: boolean;
  testbegins: boolean;
  testconducted: boolean;
  isRegistrationavailable: boolean;
  questions: any[];
  subjects: any[];
  createdBy: { name: string };
  createdAt: string;
}

export const useTestDetails = (testId: string) => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', testId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/v1/test/details/${testId}`);
      return data.data[0] as TestDetails;
    },
    enabled: !!testId,
  });

  const { data: candidates, isLoading: isLoadingCandidates, refetch: refetchCandidates } = useQuery({
    queryKey: ['test-candidates', testId],
    queryFn: async () => {
      const { data } = await apiClient.post('/api/v1/test/candidates', { _id: testId });
      return data.data || [];
    },
    enabled: !!testId,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['test-stats', testId],
    queryFn: async () => {
      const { data } = await apiClient.post('/api/v1/test/stats', { testId });
      return data.data;
    },
    enabled: !!testId,
  });

  const stopRegistrationMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/api/v1/trainer/stop-registration', { testId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', testId] });
      message.success('Registration stopped');
    },
  });

  const beginTestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/api/v1/test/begin', { id: testId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', testId] });
      message.success('Test started successfully!');
    },
    onError: (err: any) => message.error(err.message || 'Failed to start test'),
  });

  const endTestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/api/v1/test/end', { id: testId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', testId] });
      message.success('Test ended successfully!');
    },
    onError: (err: any) => message.error(err.message || 'Failed to end test'),
  });

  return {
    test,
    candidates,
    stats,
    isLoading,
    isLoadingCandidates,
    isLoadingStats,
    refetchCandidates,
    beginTest: beginTestMutation.mutateAsync,
    isStarting: beginTestMutation.isPending,
    endTest: endTestMutation.mutateAsync,
    isEnding: endTestMutation.isPending,
    stopRegistration: stopRegistrationMutation.mutateAsync,
    isStopping: stopRegistrationMutation.isPending,
  };
};
