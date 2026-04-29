import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { message } from 'antd';
import { useState } from 'react';

export const useExamPortal = (testId: string, traineeId: string) => {
  const { data: testData, isLoading: isLoadingTest } = useQuery({
    queryKey: ['test-portal', testId, traineeId],
    queryFn: async () => {
      const { data } = await apiClient.post('/api/v1/trainee/test-info', {
        testid: testId
      });
      return data.data;
    },
    enabled: !!testId,
  });

  const proceedMutation = useMutation({
    mutationFn: async () => {
      try {
        const { data } = await apiClient.post('/api/v1/trainee/answersheet', {
          testid: testId,
          userid: traineeId
        });
        return data;
      } catch (err: any) {
        if (err.response?.status === 400) {
          // Return a mock success so the UI can proceed to the portal page 
          // where the waiting screen is implemented
          return { success: true, message: 'Test not live yet' };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      if (!data.success) {
        message.error(data.message || 'Failed to proceed to test');
      }
    },
  });

  return {
    testData,
    isLoadingTest,
    proceedToTest: proceedMutation.mutateAsync,
    isProceeding: proceedMutation.isPending,
  };
};
