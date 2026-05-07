'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';

export interface Exam {
  id: string;
  testId: string;
  testName: string;
  subjectId: string;
  duration: number;
  totalQuestions: number;
  passingMarks: number;
  status: boolean;
  testbegins: boolean;
  testconducted: boolean;
  createdAt: string;
  subjects?: { id: string; topic: string }[];
}

export const useExams = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      // Backend expects a POST request for all tests
      const { data } = await apiClient.post('/api/v1/test/details/all');
      // Map backend fields (id, title) to frontend expected fields (testId, testName)
      return (data.data || []).map((item: any) => ({
        ...item,
        testId: item.id.substring(0, 8).toUpperCase(), // Fallback user-friendly ID
        testName: item.title,
      })) as Exam[];
    },
  });

  const updateTestStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: boolean }) => {
      // Simplified status update (logic may vary based on backend)
      const { data } = await apiClient.post(`/api/v1/test/status`, { _id: id, status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      message.success('Test status updated');
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/v1/test/delete`, { _id: id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      message.success('Test deleted successfully');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        message.error('Cannot delete a live test. Please end the exam first, then delete it.');
      } else {
        message.error(error.response?.data?.message || 'Failed to delete test');
      }
    },
  });

  return {
    exams,
    isLoading,
    updateStatus: updateTestStatusMutation.mutateAsync,
    deleteTest: deleteTestMutation.mutateAsync,
  };
};
