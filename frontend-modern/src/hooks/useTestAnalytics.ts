import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export const useTestAnalytics = (testId: string) => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['test-analytics', testId],
    queryFn: async () => {
      const [detailsRes, statsRes, feedbackRes, maxMarksRes] = await Promise.all([
        apiClient.post('/api/v1/test/trainer/details', { _id: testId }),
        apiClient.post('/api/v1/test/results-list', { testid: testId }),
        apiClient.post('/api/v1/trainer/get/feedbacks', { testid: testId }),
        apiClient.post('/api/v1/test/max/marks', { testid: testId })
      ]);

      return {
        details: detailsRes.data.data,
        stats: statsRes.data.data,
        feedbacks: feedbackRes.data.data,
        maxMarks: maxMarksRes.data.data
      };
    },
    enabled: !!testId,
  });

  return {
    analytics,
    isLoading
  };
};
