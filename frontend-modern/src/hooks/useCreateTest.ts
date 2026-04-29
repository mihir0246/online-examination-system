import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';

export interface TestFormData {
  testType: string;
  testTitle: string;
  testDuration: number;
  OrganisationName: string;
  testSubject: string[];
  testQuestions: string[];
}

export const useCreateTest = () => {
  const { message } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<TestFormData>({
    testType: 'pre-test',
    testTitle: '',
    testDuration: 60,
    OrganisationName: '',
    testSubject: [],
    testQuestions: [],
  });

  const queryClient = useQueryClient();

  const { data: availableQuestions, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['questions-by-subject', formData.testSubject],
    queryFn: async () => {
      if (formData.testSubject.length === 0) return [];
      const { data } = await apiClient.post('/api/v1/questions/details/all', {
        subjects: formData.testSubject,
      });
      return data.data;
    },
    enabled: currentStep === 1 && formData.testSubject.length > 0,
  });

  const createTestMutation = useMutation({
    mutationFn: async (formData: TestFormData) => {
      const payload = {
        type: formData.testType,
        title: formData.testTitle,
        duration: formData.testDuration,
        organisation: formData.OrganisationName,
        subjects: formData.testSubject,
        questions: formData.testQuestions,
      };
      const { data } = await apiClient.post('/api/v1/test/create', payload);
      return data;
    },
     onSuccess: (data) => {
      if (data.success) {
        message.success('Test created successfully!');
        queryClient.invalidateQueries({ queryKey: ['tests'] });
      } else {
        message.error(data.message || 'Failed to create test');
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Failed to create test';
      message.error(msg);
    },
  });

  const next = () => setCurrentStep((prev) => prev + 1);
  const prev = () => setCurrentStep((prev) => prev - 1);

  const updateFormData = (newData: Partial<TestFormData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  return {
    currentStep,
    formData,
    next,
    prev,
    updateFormData,
    availableQuestions,
    isLoadingQuestions,
    createTest: createTestMutation.mutateAsync,
    isSubmitting: createTestMutation.isPending,
  };
};
