'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';

export interface QuestionOption {
  id?: string;
  optbody: string;
  isAnswer: boolean;
}

export interface Question {
  id: string;
  body: string;
  subjectId: string;
  difficulty: number;
  explanation: string;
  type?: string;
  subject?: { topic: string };
  options: QuestionOption[];
}

export const useQuestions = (subjectId?: string) => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data: questions, isLoading } = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: async () => {
      // Backend expects a POST request for all questions
      const { data } = await apiClient.post('/api/v1/questions/details/all', { subject: subjectId });
      return data.data as Question[];
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (newQuestion: any) => {
      // Map legacy-style form values to modern backend schema
      const payload = {
        body: newQuestion.question || newQuestion.body,
        subjectId: newQuestion.subjectId,
        weightage: 1,
        type: newQuestion.type || "MCQ",
        explanation: newQuestion.explanation || "No explanation provided",
        difficulty: parseInt(newQuestion.level || newQuestion.difficulty) || 0,
        options: newQuestion.type === "TEXT" ? [] : [
          { optbody: newQuestion.op1, isAnswer: newQuestion.ans === "1" },
          { optbody: newQuestion.op2, isAnswer: newQuestion.ans === "2" },
          { optbody: newQuestion.op3, isAnswer: newQuestion.ans === "3" },
          { optbody: newQuestion.op4, isAnswer: newQuestion.ans === "4" },
        ].filter(o => o.optbody)
      };
      const { data } = await apiClient.post('/api/v1/questions/create', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      message.success('Question added successfully');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to add question');
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post('/api/v1/questions/delete', { _id: id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      message.success('Question deleted successfully');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete question');
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async ({ questions, subjectId }: { questions: any[], subjectId: string }) => {
      const { data } = await apiClient.post('/api/v1/questions/bulk-create', { questions, subjectId });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      message.success(data.message);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Bulk import failed');
    },
  });

  const deleteAllQuestionsMutation = useMutation({
    mutationFn: async (subjectId?: string) => {
      const { data } = await apiClient.post('/api/v1/questions/delete-all', { subjectId });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      message.success(data.message || 'All questions deleted');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete questions');
    },
  });

  return {
    questions,
    isLoading,
    createQuestion: createQuestionMutation.mutateAsync,
    bulkCreate: bulkCreateMutation.mutateAsync,
    deleteQuestion: deleteQuestionMutation.mutateAsync,
    deleteAllQuestions: deleteAllQuestionsMutation.mutateAsync,
    isCreating: createQuestionMutation.isPending || bulkCreateMutation.isPending,
    isDeleting: deleteAllQuestionsMutation.isPending,
  };
};
