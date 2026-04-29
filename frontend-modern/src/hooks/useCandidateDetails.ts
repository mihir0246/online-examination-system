import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export const useCandidateDetails = (candidateId: string | null) => {
  const { data: details, isLoading, refetch } = useQuery({
    queryKey: ['candidate-details', candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const { data } = await apiClient.post('/api/v1/test/candidates/details', { _id: candidateId });
      return data.data;
    },
    enabled: !!candidateId,
  });

  return {
    details,
    isLoading,
    refetch
  };
};
