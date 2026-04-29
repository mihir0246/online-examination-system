import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';

export const useResults = (testId: string, traineeId: string) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data: results, isLoading } = useQuery({
    queryKey: ['test-results', testId, traineeId],
    queryFn: async () => {
      const [resultRes, questionsRes, feedbackRes] = await Promise.all([
        apiClient.post('/api/v1/trainee/fetch-own-result', { testid: testId, userid: traineeId }),
        apiClient.post('/api/v1/trainee/paper/questions', { id: testId }),
        apiClient.post('/api/v1/trainee/feedback/status', { testid: testId, userid: traineeId })
      ]);

      const detailedResult = resultRes.data.result.result.map((dd: any, i: number) => ({
        ...dd,
        ...questionsRes.data.data[i]
      }));

      return {
        score: resultRes.data.result.score,
        details: detailedResult,
        hasGivenFeedback: feedbackRes.data.status,
        trainee: resultRes.data.trainee
      };
    },
    enabled: !!testId && !!traineeId,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (payload: { rating: number; feedback: string }) => {
      const { data } = await apiClient.post('/api/v1/trainee/feedback', {
        testid: testId,
        userid: traineeId,
        ...payload
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        message.success('Thank you for your feedback!');
        queryClient.invalidateQueries({ queryKey: ['test-results', testId, traineeId] });
      }
    }
  });

  return {
    results,
    isLoading,
    submitFeedback: submitFeedbackMutation.mutateAsync,
    isSubmittingFeedback: submitFeedbackMutation.isPending
  };
};
