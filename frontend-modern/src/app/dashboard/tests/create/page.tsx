'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Steps as AntSteps, Button as AntButton, Typography as AntTypography, Card as AntCard, Form as AntForm, Input as AntInput, InputNumber as AntInputNumber, Select as AntSelect, Transfer as AntTransfer, Table as AntTable, Tag as AntTag, Space as AntSpace, Divider as AntDivider, Modal } from 'antd';
import { useCreateTest, TestFormData } from '@/hooks/useCreateTest';
import { useSubjects } from '@/hooks/useSubjects';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, 
  Layers, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  HelpCircle,
  FileText
} from 'lucide-react';

const { Title, Text, Paragraph } = AntTypography;
const { Option } = AntSelect;

export default function CreateTestPage() {
  const { 
    currentStep, 
    formData, 
    next, 
    prev, 
    updateFormData, 
    availableQuestions, 
    isLoadingQuestions,
    createTest,
    isSubmitting
  } = useCreateTest();
  
  const { subjects } = useSubjects();
  const [form] = AntForm.useForm();
  const router = useRouter();

  const handleStep1Submit = async (values: any) => {
    updateFormData(values);
    next();
  };

  const steps = [
    { title: 'Basic Details', icon: <ClipboardList size={18} /> },
    { title: 'Select Questions', icon: <Layers size={18} /> },
    { title: 'Final Review', icon: <CheckCircle2 size={18} /> },
  ];

  return (
    <DashboardLayout>
    <div className="max-w-5xl mx-auto space-y-8" suppressHydrationWarning>
        <div className="text-center">
          <Title level={2} className="mb-2">Create New Examination</Title>
          <Paragraph className="text-slate-500">Follow the steps below to configure your test parameters and question bank.</Paragraph>
        </div>

        <AntSteps 
          current={currentStep} 
          className="premium-steps mb-12"
          items={steps.map(s => ({ title: s.title, icon: s.icon }))}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <AntCard className="glass-card border-none shadow-xl p-6">
                <AntForm
                  form={form}
                  layout="vertical"
                  initialValues={formData}
                  onFinish={handleStep1Submit}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AntForm.Item
                      name="testType"
                      label="Examination Type"
                      rules={[{ required: true }]}
                    >
                      <AntSelect size="large">
                        <Option value="pre-test">Pre-Test Assessment</Option>
                        <Option value="post-test">Post-Test Certification</Option>
                      </AntSelect>
                    </AntForm.Item>

                    <AntForm.Item
                      name="testTitle"
                      label="Test Title"
                      rules={[{ required: true, min: 5 }]}
                    >
                      <AntInput placeholder="e.g. Advanced React Architecture" size="large" />
                    </AntForm.Item>

                    <AntForm.Item
                      name="testSubject"
                      label="Select Subjects"
                      rules={[{ required: true, type: 'array' }]}
                    >
                      <AntSelect
                        mode="multiple"
                        placeholder="Choose one or more topics"
                        size="large"
                        className="w-full"
                      >
                        {subjects?.map((s, idx) => {
                          const uniqueId = s.id || s._id || `subject-fallback-${idx}`;
                          return <Option key={uniqueId} value={uniqueId}>{s.topic}</Option>
                        })}
                      </AntSelect>
                    </AntForm.Item>

                    <AntForm.Item
                      name="testDuration"
                      label="Duration (Minutes)"
                      rules={[{ required: true }]}
                    >
                      <AntInputNumber min={60} max={180} className="w-full" size="large" />
                    </AntForm.Item>

                    <AntForm.Item
                      name="OrganisationName"
                      label="Organisation (Optional)"
                      className="md:col-span-2"
                    >
                      <AntInput placeholder="e.g. Acme Corporation" size="large" />
                    </AntForm.Item>
                  </div>

                  <div className="flex justify-end pt-6">
                    <AntButton type="primary" htmlType="submit" size="large" className="h-12 px-8 rounded-xl font-bold">
                      Next Step <ChevronRight size={18} className="ml-2" />
                    </AntButton>
                  </div>
                </AntForm>
              </AntCard>
            )}

            {currentStep === 1 && (
              <AntCard className="glass-card border-none shadow-xl p-6">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <Title level={4} className="mb-1">Choose Questions</Title>
                    <Text type="secondary">Select from the available pool or use random selection.</Text>
                  </div>
                  <AntTag color="blue" className="text-sm px-4 py-1 rounded-full font-bold">
                    {formData.testQuestions.length} Questions Selected
                  </AntTag>
                </div>

                <AntTransfer
                  dataSource={availableQuestions || []}
                  showSearch
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                  styles={{ section: { width: 'calc(50% - 30px)', height: 450 } }}
                  targetKeys={formData.testQuestions}
                  onChange={(keys) => updateFormData({ testQuestions: keys as string[] })}
                  render={item => (
                    <div title={item.body} style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.body}
                    </div>
                  )}
                  rowKey={item => item.id || item._id || item.body}
                  titles={['Available Pool', 'Selected for Test']}
                  className="modern-transfer"
                />

                <div className="flex justify-between pt-10">
                  <AntButton onClick={prev} size="large" className="h-12 px-8 rounded-xl font-bold glass">
                    <ChevronLeft size={18} className="mr-2" /> Back
                  </AntButton>
                  <AntButton 
                    type="primary" 
                    onClick={next} 
                    size="large" 
                    disabled={formData.testQuestions.length === 0}
                    className="h-12 px-8 rounded-xl font-bold"
                  >
                    Review Test <ChevronRight size={18} className="ml-2" />
                  </AntButton>
                </div>
              </AntCard>
            )}

            {currentStep === 2 && (
              <AntCard className="glass-card border-none shadow-xl p-6">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <Title level={3}>Confirm Test Configuration</Title>
                  <Paragraph className="text-slate-500 text-base">Please review the details below before finalizing the creation.</Paragraph>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                      <Text type="secondary" className="block text-xs uppercase font-bold tracking-widest mb-1">Title & Type</Text>
                      <Text className="text-lg font-bold block">{formData.testTitle}</Text>
                      <AntTag color="blue" className="mt-1">{formData.testType.toUpperCase()}</AntTag>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                      <Text type="secondary" className="block text-xs uppercase font-bold tracking-widest mb-1">Duration & Scale</Text>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2"><FileText size={16} /> {formData.testDuration} Minutes</span>
                        <span className="flex items-center gap-2"><HelpCircle size={16} /> {formData.testQuestions.length} Questions</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center">
                    <Text type="secondary" className="mb-4">Ready to launch?</Text>
                    <AntButton 
                      type="primary" 
                      size="large" 
                      block 
                      loading={isSubmitting}
                      onClick={async () => {
                        const res = await createTest(formData);
                        if (res.success && res.testid) {
                          router.push(`/dashboard/tests/${res.testid}`);
                        }
                      }}
                      className="h-14 text-lg font-bold rounded-2xl shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 border-none"
                    >
                      Publish Test Now
                    </AntButton>
                  </div>
                </div>

                <div className="flex justify-start">
                  <AntButton onClick={prev} size="large" className="glass h-12 px-8 rounded-xl font-bold">
                    <ChevronLeft size={18} className="mr-2" /> Adjust Details
                  </AntButton>
                </div>
              </AntCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
