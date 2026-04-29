'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, App } from 'antd';
import { motion } from 'framer-motion';
import { User, Lock, Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { login } from '@/lib/store';
import apiClient from '@/services/apiClient';

const { Text } = Typography;

export default function LoginPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { control, handleSubmit, formState: { errors } } = useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/v1/login/', {
        emailid: values.email,
        password: values.password,
      });

      if (data.success) {
        message.success('Login successful!');
        if (data.token) localStorage.setItem('authToken', data.token);
        dispatch(login(data.user));
        router.push('/dashboard');
      } else {
        ModalError(data.message || 'Invalid emailid');
      }
    } catch (error: any) {
      console.error(error);
      ModalError(error.response?.data?.message || 'Invalid emailid');
    } finally {
      setLoading(false);
    }
  };

  const ModalError = (msg: string) => {
    message.error({
      content: (
        <div className="p-4">
          <div className="text-red-500 font-bold text-lg mb-2">Error!</div>
          <div className="text-slate-600">{msg}</div>
        </div>
      ),
      icon: null,
      duration: 3,
      style: { marginTop: '20vh' }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden tech-pattern">
      {/* Tech Eye Decoration (CSS Approximation) */}
      <div className="absolute left-[10%] top-1/2 -translate-y-1/2 hidden lg:block">
        <div className="relative w-[500px] h-[500px]">
          <div className="cyber-circle w-full h-full border-2 border-teal-500/20 animate-[spin_20s_linear_infinite]" />
          <div className="cyber-circle w-[80%] h-[80%] left-[10%] top-[10%] border-teal-500/30 animate-[spin_15s_linear_infinite_reverse]" />
          <div className="cyber-circle w-[60%] h-[60%] left-[20%] top-[20%] border-teal-500/40 animate-[spin_10s_linear_infinite]" />
          <div className="cyber-circle w-[40%] h-[40%] left-[30%] top-[30%] border-teal-500/50 bg-teal-500/5 shadow-[0_0_50px_rgba(0,191,165,0.2)]" />
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
          <div className="absolute left-1/2 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-teal-500/50 to-transparent" />
        </div>
      </div>

      <div className="container mx-auto px-6 flex justify-end">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex items-center gap-2">
             <div className="w-10 h-10 bg-green-900/50 border border-green-500 flex items-center justify-center rounded text-green-500 font-bold text-xl">NP</div>
          </div>

          <Card className="bg-[#1a222c]/90 border-none shadow-2xl p-2 rounded-lg">
            <form onSubmit={handleSubmit(onFinish)} className="space-y-6">
               <div>
                  <label className="text-red-500 text-xs font-bold mb-1 block">* Email :</label>
                  <Controller
                    name="email"
                    control={control}
                    rules={{ required: 'Email is required' }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        size="large"
                        prefix={<User className="w-4 h-4 text-slate-400 mr-2" />}
                        className="bg-[#2a3441] border-none text-white h-11"
                        placeholder="example@mail.com"
                      />
                    )}
                  />
               </div>

               <div>
                  <label className="text-red-500 text-xs font-bold mb-1 block">* Password :</label>
                  <Controller
                    name="password"
                    control={control}
                    rules={{ required: 'Password is required' }}
                    render={({ field }) => (
                      <Input.Password
                        {...field}
                        size="large"
                        prefix={<Lock className="w-4 h-4 text-slate-400 mr-2" />}
                        className="bg-[#2a3441] border-none text-white h-11"
                        placeholder="•••••"
                      />
                    )}
                  />
               </div>

               <Button 
                type="primary" 
                htmlType="submit" 
                block 
                size="large" 
                loading={loading}
                className="h-11 bg-[#0d3b66] hover:bg-[#1a508b] border-none mt-4"
              >
                {!loading ? 'Login' : 'Authenticating...'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
