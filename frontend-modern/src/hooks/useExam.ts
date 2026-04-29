import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { App } from 'antd';
import { useState } from 'react';

export const useExam = () => {
  const { message } = App.useApp();
  const [candidate, setCandidate] = useState<any>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const registerTraineeMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Backend endpoint is /enter for registration
      const { data } = await apiClient.post('/api/v1/trainee/enter', payload);
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setCandidate(data.user);
        setRegistrationSuccess(true);
        message.success('Registration successful! Please check your email for the test link.');
      } else {
        message.error(data.message || 'Registration failed');
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Server error during registration';
      message.error(msg);
    },
  });

  const resendMailMutation = useMutation({
    mutationFn: async (id: string) => {
      // Backend endpoint is /resend/testlink
      const { data } = await apiClient.post('/api/v1/trainee/resend/testlink', { id });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        message.success('Test link resent successfully!');
      } else {
        message.error(data.message);
      }
    },
  });

  return {
    candidate,
    registrationSuccess,
    register: registerTraineeMutation.mutateAsync,
    isRegistering: registerTraineeMutation.isPending,
    resendMail: resendMailMutation.mutateAsync,
    isResending: resendMailMutation.isPending,
  };
};
