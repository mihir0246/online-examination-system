'use client';

import React, { useState } from 'react';
import { 
  Typography, 
  Card, 
  Table, 
  Tag, 
  Rate, 
  Input, 
  Button, 
  Row, 
  Col, 
  Statistic, 
  Progress,
  Divider,
  Modal,
  Avatar,
  Space
} from 'antd';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Share2, 
  Download,
  Info,
  ChevronRight,
  User,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResults } from '@/hooks/useResults';
import { useParams, useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function ResultsPage() {
  const params = useParams();
  const testId = params.testId as string;
  const traineeId = params.traineeId as string;
  const { results, isLoading, submitFeedback, isSubmittingFeedback } = useResults(testId, traineeId);

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const columns = [
    {
      title: 'Question',
      dataIndex: 'body',
      key: 'body',
      render: (text: string) => <Text className="font-medium">{text}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'iscorrect',
      key: 'iscorrect',
      width: 120,
      render: (isCorrect: boolean) => (
        isCorrect 
        ? <Tag color="green" icon={<CheckCircle2 size={12} className="mr-1 inline" />}>Correct</Tag>
        : <Tag color="red" icon={<XCircle size={12} className="mr-1 inline" />}>Incorrect</Tag>
      )
    },
    {
      title: 'Correct Ans',
      dataIndex: 'correctAnswer',
      key: 'correctAnswer',
      render: (ans: string[]) => (
        <Space size={4}>
          {ans.map(a => <Tag color="blue" key={a}>{a.toUpperCase()}</Tag>)}
        </Space>
      )
    },
    {
      title: 'Your Ans',
      dataIndex: 'givenAnswer',
      key: 'givenAnswer',
      render: (ans: string[]) => (
        <Space size={4}>
          {ans.map(a => <Tag color={a === 'skipped' ? 'default' : 'cyan'} key={a}>{a.toUpperCase()}</Tag>)}
        </Space>
      )
    }
  ];

  if (isLoading) return <div className="p-12 text-center"><Title level={3}>Analyzing performance...</Title></div>;

  const scorePercentage = results ? (results.score / results.details.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Simple Confirmation Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card border-none shadow-2xl p-8 text-center bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <Title level={1} className="text-white mb-2">Examination Submitted!</Title>
            <Paragraph className="text-indigo-100 text-lg max-w-2xl mx-auto">
              Well done, {results?.trainee?.name || 'Candidate'}! You have successfully completed the <strong>Examination</strong>. 
              Your results will be processed and shared with you by your trainer via email shortly.
            </Paragraph>
          </Card>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {/* Feedback Section - Now the focus */}
          {!results?.hasGivenFeedback ? (
            <Card 
              title={<span className="flex items-center gap-2"><MessageSquare size={18} /> How was your experience?</span>} 
              className="glass-card border-none shadow-xl"
            >
              <Paragraph className="text-slate-500 mb-6">
                Your feedback is valuable to us. Please take a moment to rate the examination portal and the difficulty level of the test.
              </Paragraph>
              
              <div className="space-y-6">
                <div className="text-center">
                  <Rate 
                    allowHalf 
                    onChange={setRating} 
                    value={rating} 
                    character={<Star fill={rating > 0 ? "currentColor" : "none"} />}
                    className="text-4xl text-indigo-600"
                  />
                  <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Rate your experience</div>
                </div>
                
                <TextArea 
                  rows={4} 
                  placeholder="Any comments about the test questions or the portal experience?" 
                  className="rounded-xl border-slate-200 focus:border-indigo-500"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                
                <Button 
                  type="primary" 
                  block 
                  size="large" 
                  disabled={!rating || !feedback}
                  loading={isSubmittingFeedback}
                  onClick={() => submitFeedback({ rating, feedback })}
                  className="h-14 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 border-none text-lg shadow-lg"
                >
                  Submit & Finish
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="glass-card border-none text-center p-12 shadow-xl bg-white dark:bg-slate-900">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <Title level={3}>Feedback Received</Title>
              <Paragraph className="text-slate-500 text-lg mb-8">
                Thank you for your response. You may now close this window or return to the main portal.
              </Paragraph>
              <Space size="middle" wrap className="justify-center mt-4">
                <Button 
                  type="default" 
                  size="large" 
                  onClick={() => window.location.href = '/'}
                  className="rounded-xl h-12 px-10 font-bold"
                >
                  Go to Homepage
                </Button>
                <Button 
                  type="dashed" 
                  size="large" 
                  icon={<Download size={16} />}
                  onClick={async () => {
                    try {
                      const { default: apiClient } = await import('@/services/apiClient');
                      const { data } = await apiClient.get('/api/v1/trainee/export-my-data');
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'my-exam-data.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Data export failed:', error);
                    }
                  }}
                  className="rounded-xl h-12 px-10 font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Download my data
                </Button>
              </Space>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
