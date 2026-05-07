'use client';

import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Card, 
  Button, 
  Divider, 
  Checkbox, 
  Space,
  App 
} from 'antd';
import { 
  AlertCircle, 
  Play, 
  Timer, 
  ShieldAlert, 
  BookMarked, 
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useExamPortal } from '@/hooks/useExamPortal';
import { useParams, useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

export default function InstructionPage() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const traineeId = params.traineeId as string;
  
  const { testData, isLoadingTest, proceedToTest, isProceeding } = useExamPortal(testId, traineeId);
  const [agreed, setAgreed] = useState(false);

  const handleProceed = async () => {
    if (!agreed) {
      message.warning('Please agree to the instructions before proceeding.');
      return;
    }
    try {
      const result = await proceedToTest();
      if (result.success) {
        router.push(`/exam/portal/${testId}/${traineeId}`);
      } else {
        message.error(result.message || 'Error starting exam');
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        message.warning('Exam already submitted. Redirecting to portal...');
        router.push(`/exam/portal/${testId}/${traineeId}`);
      } else {
        message.error(err.response?.data?.message || 'Error starting exam');
      }
    }
  };

  const instructions = [
    {
      icon: <CheckCircle2 size={18} className="text-green-500" />,
      text: "All questions are compulsory and carry equal marks."
    },
    {
      icon: <BookMarked size={18} className="text-blue-500" />,
      text: "You can bookmark questions for review and return to them later."
    },
    {
      icon: <Timer size={18} className="text-amber-500" />,
      text: `This examination is time-bound (${testData?.duration || 60} minutes). A real-time timer is displayed.`
    },
    {
      icon: <ShieldAlert size={18} className="text-red-500" />,
      text: "Tab switching or opening other windows will be detected and reported."
    },
    {
      icon: <AlertCircle size={18} className="text-indigo-500" />,
      text: "The test will automatically submit when the timer reaches zero."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl"
      >
        <Card className="glass-card border-none shadow-2xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
              <Play size={24} />
            </div>
            <div>
              <Title level={2} className="mb-0">General Instructions</Title>
              <Text type="secondary">Please read carefully before starting the examination.</Text>
            </div>
          </div>

          <Divider className="my-6" />

          <div className="space-y-4">
            {instructions.map((item, index) => (
              <div key={index} className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                <div className="mt-1">{item.icon}</div>
                <Text className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.text}
                </Text>
              </div>
            ))}
          </div>

          <div className="mt-10 p-6 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5">
            <Title level={5} className="mb-3">System Requirements & Conduct</Title>
            <Paragraph className="text-sm text-slate-500 mb-0">
              Ensure you have a stable internet connection. To save your answers, always click the <Text className="font-bold">"Save & Next"</Text> button. Your activity is being monitored for proctoring purposes.
            </Paragraph>
          </div>

          <div className="mt-8 flex flex-col items-center gap-6">
            <Checkbox 
              checked={agreed} 
              onChange={(e) => setAgreed(e.target.checked)}
              className="text-slate-600 font-medium"
            >
              I have read and understood all the instructions and system requirements.
            </Checkbox>

            <Button 
              type="primary" 
              size="large" 
              icon={<ChevronRight size={20} />}
              loading={isProceeding}
              onClick={handleProceed}
              className="h-14 px-12 rounded-2xl font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 border-none flex-row-reverse gap-3"
            >
              Proceed to Examination
            </Button>
          </div>
        </Card>
      </motion.div>
      
      <div className="mt-12 text-slate-400 text-xs flex items-center gap-2">
        <ShieldAlert size={14} /> Secure Proctoring Session Active
      </div>
    </div>
  );
}
