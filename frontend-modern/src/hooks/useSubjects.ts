import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface Subject {
  id: string;
  _id?: string; // For compatibility
  topic: string;
}

export const useSubjects = () => {
  const queryClient = useQueryClient();

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/subject/details/all');
      return data.data as Subject[];
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (newSubject: any) => {
      const { data } = await apiClient.post('/api/v1/subject/create', newSubject);
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
      }
    },
  });

  return {
    subjects,
    isLoading,
    createSubject: createSubjectMutation.mutateAsync,
    isCreating: createSubjectMutation.isPending,
  };
};
