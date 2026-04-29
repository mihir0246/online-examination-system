import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface Trainer {
  id: string;
  name: string;
  emailid: string;
  contact: string;
  subjectIds?: string[];
}

export const useTrainers = () => {
  const queryClient = useQueryClient();

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['trainers'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/admin/trainer/details/all');
      return data.data as Trainer[];
    },
  });

  const createTrainerMutation = useMutation({
    mutationFn: async (newTrainer: any) => {
      const { data } = await apiClient.post('/api/v1/admin/trainer/create', newTrainer);
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['trainers'] });
      }
    },
  });

  const deleteTrainerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post('/api/v1/admin/trainer/remove', { _id: id });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['trainers'] });
      }
    },
  });

  return {
    trainers,
    isLoading,
    createTrainer: createTrainerMutation.mutateAsync,
    deleteTrainer: deleteTrainerMutation.mutateAsync,
    isCreating: createTrainerMutation.isPending,
    isDeleting: deleteTrainerMutation.isPending,
  };
};
